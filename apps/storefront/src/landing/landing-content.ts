import { PublicContentError } from '../content';

export type LandingMedia = {
  id: string;
  publicUrl: string | null;
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
      title: string;
      sectionId: string;
      effectiveCoverUrl: string | null;
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
      chatWelcome: string | null;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type LandingPublicationPointer = {
  schemaVersion: 1;
  slug: string;
  artifactKey: string;
  publishedAt: string;
};

function isLandingPointer(value: unknown): value is LandingPublicationPointer {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.slug === 'string' &&
    typeof value.artifactKey === 'string' &&
    /^public\/landing-publications\/v1\/artifacts\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.json$/u.test(
      value.artifactKey,
    ) &&
    typeof value.publishedAt === 'string'
  );
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
    typeof product.title === 'string' &&
    typeof product.sectionId === 'string' &&
    (product.effectiveCoverUrl === null ||
      typeof product.effectiveCoverUrl === 'string') &&
    Array.isArray(product.media) &&
    model.templateKey === 'direct_response' &&
    isRecord(resolved) &&
    typeof resolved.headline === 'string' &&
    (resolved.subheadline === null || typeof resolved.subheadline === 'string') &&
    typeof resolved.body === 'string' &&
    (resolved.heroAsset === null || isRecord(resolved.heroAsset)) &&
    (resolved.ctaLabel === null || typeof resolved.ctaLabel === 'string') &&
    (resolved.chatWelcome === null || typeof resolved.chatWelcome === 'string')
  );
}

export async function loadLandingSnapshot(
  slug: string,
  signal?: AbortSignal,
): Promise<LandingSnapshot> {
  const pointerResponse = await fetch(
    `/public/landing-publications/v1/pointers/${encodeURIComponent(slug)}.json`,
    {
      method: 'GET',
      cache: 'force-cache',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    },
  );
  if (!pointerResponse.ok) {
    throw new PublicContentError(
      'CONTENT_NOT_PUBLISHED',
      'This landing page is unavailable.',
    );
  }
  const pointerValue: unknown = await pointerResponse.json();
  if (!isLandingPointer(pointerValue) || pointerValue.slug !== slug) {
    throw new PublicContentError(
      'SNAPSHOT_VERSION_MISMATCH',
      'The landing page is inconsistent.',
    );
  }
  const response = await fetch(
    `/public/${pointerValue.artifactKey.slice('public/'.length)}`,
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
