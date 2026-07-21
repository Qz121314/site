const MAX_SLUG_ATTEMPTS = 1_000;

function stableToken(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function automaticSlug(value: string, prefix: string, maxLength: number): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const base = normalized || `${prefix}-${stableToken(value.trim() || prefix)}`;
  return base.slice(0, maxLength).replace(/-+$/gu, "") || `${prefix}-${stableToken(value)}`.slice(0, maxLength);
}

export function selectUniqueSlug(
  base: string,
  maxLength: number,
  existingSlugs: Iterable<string>,
): string {
  const existing = new Set(existingSlugs);
  for (let index = 1; index <= MAX_SLUG_ATTEMPTS; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const candidate = `${base.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base.slice(0, Math.max(1, maxLength - 9))}-${crypto.randomUUID().slice(0, 8)}`;
}
