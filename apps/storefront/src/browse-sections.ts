export type BrowseSectionPresentation = {
  id: string;
  description: string | null;
  backgroundUrl: string | null;
  productCount: number;
};

type BrowseSectionEnvelope = {
  sections?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePresentation(value: unknown): BrowseSectionPresentation | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    (typeof value.description !== 'string' && value.description !== null) ||
    (typeof value.backgroundUrl !== 'string' && value.backgroundUrl !== null) ||
    typeof value.productCount !== 'number' ||
    !Number.isFinite(value.productCount)
  ) {
    return null;
  }
  return {
    id: value.id,
    description: value.description,
    backgroundUrl: value.backgroundUrl,
    productCount: Math.max(0, Math.floor(value.productCount)),
  };
}

export async function loadBrowseSectionPresentations(
  signal?: AbortSignal,
): Promise<BrowseSectionPresentation[]> {
  const response = await fetch('/api/public/browse-sections/', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error('Browse section presentation is unavailable.');
  const body = await response.json() as BrowseSectionEnvelope;
  if (!Array.isArray(body.sections)) throw new Error('Browse section presentation is invalid.');
  return body.sections.flatMap((item) => {
    const parsed = parsePresentation(item);
    return parsed ? [parsed] : [];
  });
}
