export function buildPublicImageUrl(baseUrl: string, objectKey: string): string | null {
  const normalizedBase = baseUrl.trim().replace(/\/+$/u, "");
  const normalizedKey = objectKey.trim().replace(/^\/+|\/+$/gu, "");
  if (!normalizedBase || !normalizedKey) return null;

  const encodedKey = normalizedKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizedBase}/${encodedKey}`;
}
