export type PublicConversionType = "url" | "phone" | "whatsapp" | "telegram" | "email";

export type PublicConversionResource = {
  type: PublicConversionType;
  value: string;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function normalizeConversionTarget(resource: PublicConversionResource): string | null {
  const value = resource.value.trim();
  if (!value) return null;

  switch (resource.type) {
    case "url":
      return isHttpUrl(value) ? value : null;
    case "phone": {
      const phone = value.replace(/[^+0-9]/gu, "").replace(/(?!^)\+/gu, "");
      return phone ? `tel:${phone}` : null;
    }
    case "whatsapp": {
      if (isHttpUrl(value)) return value;
      const digits = value.replace(/\D/gu, "");
      return digits ? `https://wa.me/${digits}` : null;
    }
    case "telegram": {
      if (isHttpUrl(value)) return value;
      const handle = value.replace(/^@/u, "");
      return /^[A-Za-z0-9_]{3,64}$/u.test(handle)
        ? `https://t.me/${encodeURIComponent(handle)}`
        : null;
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) ? `mailto:${value}` : null;
  }
}
