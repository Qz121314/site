export function normalizeSupportPhoneValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^\+?[0-9]{5,18}$/u.test(normalized) ? normalized : null;
}

export function normalizeSupportLinkValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || input.length > 2048) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}
