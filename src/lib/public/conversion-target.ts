export type PublicConversionType = "link" | "sms";

export type PublicConversionResource = {
  type: PublicConversionType;
  value: string;
};

export type PublicConversionContact = {
  type: PublicConversionType;
  value: string;
  display: string;
  target: string;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function normalizeLink(value: string): { target: string; display: string } | null {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;

    if (url.protocol === "http:" || url.protocol === "https:") {
      return { target: url.toString(), display: url.toString() };
    }

    if (url.protocol === "mailto:") {
      const email = value.slice("mailto:".length);
      return isEmail(email) ? { target: `mailto:${email}`, display: email } : null;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeSms(value: string): { target: string; display: string } | null {
  const display = value.trim();
  if (!/^[+0-9() .-]+$/u.test(display)) return null;
  const digits = display.replace(/\D/gu, "");
  if (digits.length < 5 || digits.length > 20) return null;
  const prefix = display.startsWith("+") ? "+" : "";
  return { target: `sms:${prefix}${digits}`, display };
}

export function normalizeConversionResource(resource: PublicConversionResource): PublicConversionContact | null {
  const value = resource.value.trim();
  if (!value) return null;

  const normalized = resource.type === "sms" ? normalizeSms(value) : normalizeLink(value);
  return normalized
    ? {
        type: resource.type,
        value,
        display: normalized.display,
        target: normalized.target,
      }
    : null;
}

export function normalizeConversionTarget(resource: PublicConversionResource): string | null {
  return normalizeConversionResource(resource)?.target ?? null;
}
