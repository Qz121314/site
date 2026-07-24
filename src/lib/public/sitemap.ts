const SQLITE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/u;
const ISO_TIMESTAMP_WITHOUT_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u;

export function normalizeSitemapLastModified(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = SQLITE_TIMESTAMP.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z`
    : ISO_TIMESTAMP_WITHOUT_ZONE.test(trimmed)
      ? `${trimmed}Z`
      : trimmed;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
