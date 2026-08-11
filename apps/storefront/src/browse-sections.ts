import type { StorefrontBootstrap } from './content';

export type BrowseSectionPresentation = {
  id: string;
  description: string | null;
  backgroundUrl: string | null;
};

type BrowseSectionEnvelope = {
  sections?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function encodeObjectKey(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function mediaUrl(baseUrl: string, objectKey: string | null): string | null {
  return baseUrl && objectKey ? `${baseUrl}/${encodeObjectKey(objectKey)}` : null;
}

function parsePublishedPresentation(
  value: unknown,
  mediaBaseUrl: string,
): { presentation: BrowseSectionPresentation; hasPublishedPresentation: boolean } | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const hasPublishedPresentation =
    Object.prototype.hasOwnProperty.call(value, 'description') ||
    Object.prototype.hasOwnProperty.call(value, 'browseBackgroundObjectKey');
  if (
    value.description !== undefined &&
    typeof value.description !== 'string' &&
    value.description !== null
  ) {
    return null;
  }
  if (
    value.browseBackgroundObjectKey !== undefined &&
    typeof value.browseBackgroundObjectKey !== 'string' &&
    value.browseBackgroundObjectKey !== null
  ) {
    return null;
  }
  return {
    presentation: {
      id: value.id,
      description: typeof value.description === 'string' ? value.description : null,
      backgroundUrl: mediaUrl(
        mediaBaseUrl,
        typeof value.browseBackgroundObjectKey === 'string'
          ? value.browseBackgroundObjectKey
          : null,
      ),
    },
    hasPublishedPresentation,
  };
}

function parseLegacyPresentation(value: unknown): BrowseSectionPresentation | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    (typeof value.description !== 'string' && value.description !== null) ||
    (typeof value.backgroundUrl !== 'string' && value.backgroundUrl !== null)
  ) {
    return null;
  }
  return {
    id: value.id,
    description: value.description,
    backgroundUrl: value.backgroundUrl,
  };
}

async function loadLegacyBrowseSectionPresentations(
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
  const body = (await response.json()) as BrowseSectionEnvelope;
  if (!Array.isArray(body.sections))
    throw new Error('Browse section presentation is invalid.');
  return body.sections.flatMap((item) => {
    const parsed = parseLegacyPresentation(item);
    return parsed ? [parsed] : [];
  });
}

export async function loadBrowseSectionPresentations(
  bootstrap: StorefrontBootstrap,
  signal?: AbortSignal,
): Promise<BrowseSectionPresentation[]> {
  if (bootstrap.pointer.schemaVersion !== 2) {
    return loadLegacyBrowseSectionPresentations(signal);
  }

  const reference = bootstrap.pointer.sectionsIndex;
  const response = await fetch(
    `${bootstrap.origin}/public/modules/sections-index/${encodeURIComponent(reference.contentVersion)}/sections.json`,
    {
      method: 'GET',
      credentials: 'omit',
      cache: 'force-cache',
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    },
  );
  if (!response.ok) throw new Error('Browse section presentation is unavailable.');
  const body = (await response.json()) as unknown;
  if (
    !isRecord(body) ||
    body.schemaVersion !== 2 ||
    body.moduleKey !== 'sections-index' ||
    body.contentVersion !== reference.contentVersion ||
    !Array.isArray(body.sections)
  ) {
    throw new Error('Browse section presentation is invalid.');
  }

  let publishedPresentationAvailable = false;
  const presentations = body.sections.flatMap((item) => {
    const parsed = parsePublishedPresentation(item, bootstrap.site.site.mediaBaseUrl);
    if (!parsed) return [];
    publishedPresentationAvailable ||= parsed.hasPublishedPresentation;
    return [parsed.presentation];
  });

  // Current production may still point at a retained sections-index version created
  // before Browse presentation joined the immutable publication contract. Keep the
  // legacy endpoint only for that transition; every newly published index uses R2.
  return publishedPresentationAvailable
    ? presentations
    : loadLegacyBrowseSectionPresentations(signal);
}
