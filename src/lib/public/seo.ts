const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (entity, token: string) => {
    const normalized = token.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return NAMED_ENTITIES[normalized] ?? entity;
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function plainTextFromHtml(html: string): string {
  return normalizeWhitespace(decodeHtmlEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, " ")
      .replace(/<[^>]+>/gu, " "),
  ));
}

export function truncateText(value: string, maximumLength = 160): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maximumLength) return normalized;

  const candidate = normalized.slice(0, Math.max(1, maximumLength - 1)).trimEnd();
  const lastSpace = candidate.lastIndexOf(" ");
  const boundary = lastSpace >= Math.floor(maximumLength * .65) ? lastSpace : candidate.length;
  return `${candidate.slice(0, boundary).replace(/[\s,.;:!?-]+$/gu, "")}…`;
}

export function productDescription(options: {
  title: string;
  bodyHtml: string;
  tags: string[];
  siteDescription: string;
  maximumLength?: number;
}): string {
  const body = plainTextFromHtml(options.bodyHtml);
  const fallback = [
    options.title,
    options.tags.length > 0 ? options.tags.slice(0, 4).join(", ") : "",
    options.siteDescription,
  ].filter(Boolean).join(" — ");

  return truncateText(body || fallback, options.maximumLength ?? 160);
}
