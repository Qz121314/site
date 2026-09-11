import { PublicContentError } from '../content';

export type LandingMedia = {
  id: string;
  url: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  sortOrder: number;
};

export type LandingSnapshot = {
  schemaVersion: 1;
  model: {
    landing: { slug: string; name: string };
    templateKey: 'direct_response';
    product: {
      id: string;
      media: LandingMedia[];
    };
    resolved: {
      headline: string;
      subheadline: string | null;
      body: string;
      heroAsset: {
        assetId: string;
        objectKey: string;
        publicUrl: string | null;
        width: number | null;
        height: number | null;
      } | null;
      ctaLabel: string | null;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLandingSnapshot(value: unknown): value is LandingSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.model))
    return false;
  const model = value.model;
  const landing = model.landing;
  const product = model.product;
  const resolved = model.resolved;
  return (
    isRecord(landing) &&
    typeof landing.slug === 'string' &&
    typeof landing.name === 'string' &&
    isRecord(product) &&
    typeof product.id === 'string' &&
    Array.isArray(product.media) &&
    model.templateKey === 'direct_response' &&
    isRecord(resolved) &&
    typeof resolved.headline === 'string' &&
    (resolved.subheadline === null || typeof resolved.subheadline === 'string') &&
    typeof resolved.body === 'string' &&
    (resolved.heroAsset === null || isRecord(resolved.heroAsset)) &&
    (resolved.ctaLabel === null || typeof resolved.ctaLabel === 'string')
  );
}

export async function loadLandingSnapshot(
  slug: string,
  signal?: AbortSignal,
): Promise<LandingSnapshot> {
  const response = await fetch(
    `/public/landing-publications/v1/${encodeURIComponent(slug)}.json`,
    {
      method: 'GET',
      cache: 'force-cache',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    },
  );
  if (!response.ok) {
    throw new PublicContentError(
      'CONTENT_NOT_PUBLISHED',
      'This landing page is unavailable.',
    );
  }
  const value: unknown = await response.json();
  if (!isLandingSnapshot(value)) {
    throw new PublicContentError(
      'SNAPSHOT_VERSION_MISMATCH',
      'The landing page is inconsistent.',
    );
  }
  return value;
}
