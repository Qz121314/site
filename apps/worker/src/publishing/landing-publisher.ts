import {
  buildLandingModel,
  validateLandingDependencies,
  type LandingBuildModel,
  type LandingRecord,
} from '../landing/landing-pages';

export const LANDING_PUBLICATION_SCHEMA_VERSION = 1;
export const LANDING_PUBLICATION_PREFIX = 'public/landing-publications/v1';
export const LANDING_PUBLICATION_ARTIFACT_PREFIX = `${LANDING_PUBLICATION_PREFIX}/artifacts`;
export const LANDING_PUBLICATION_POINTER_PREFIX = `${LANDING_PUBLICATION_PREFIX}/pointers`;

export function landingPublicationKey(slug: string): string {
  return `${LANDING_PUBLICATION_POINTER_PREFIX}/${slug}.json`;
}

export function landingPublicationArtifactKey(
  landingId: string,
  version: string,
): string {
  return `${LANDING_PUBLICATION_ARTIFACT_PREFIX}/${landingId}/${version}.json`;
}

export const LANDING_PUBLICATION_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export type LandingPublication = {
  schemaVersion: typeof LANDING_PUBLICATION_SCHEMA_VERSION;
  key: string;
  pointerKey: string;
  artifactKey: string;
  model: LandingBuildModel;
};

export type LandingPublicationPointer = {
  schemaVersion: typeof LANDING_PUBLICATION_SCHEMA_VERSION;
  slug: string;
  artifactKey: string;
  publishedAt: string;
};

export async function validateLandingPublication(db: D1Database, landing: LandingRecord) {
  if (landing.deletedAt || landing.status !== 'published')
    return {
      ok: false as const,
      code: 'LANDING_NOT_PUBLISHABLE',
      message: '只有未删除的已发布落地页可以生成 publication。',
    };
  if (landing.templateKey !== 'direct_response')
    return {
      ok: false as const,
      code: 'LANDING_TEMPLATE_NOT_PUBLISHABLE',
      message: '当前只有 Direct Response 模板可以生成 publication。',
    };
  return validateLandingDependencies(db, {
    name: landing.name,
    slug: landing.slug,
    productId: landing.productId,
    templateKey: landing.templateKey,
    chatTemplateKey: landing.chatTemplateKey,
    headlineOverride: landing.headlineOverride,
    subheadlineOverride: landing.subheadlineOverride,
    heroAssetId: landing.heroAssetId,
    ctaLabelOverride: landing.ctaLabelOverride,
    chatWelcomeOverride: landing.chatWelcomeOverride,
    status: landing.status,
  });
}

export async function buildLandingPublication(
  db: D1Database,
  landing: LandingRecord,
): Promise<LandingPublication | null> {
  const validation = await validateLandingPublication(db, landing);
  if (!validation.ok) return null;
  const model = await buildLandingModel(db, landing);
  const artifactKey = landingPublicationArtifactKey(landing.id, crypto.randomUUID());
  return model
    ? {
        schemaVersion: LANDING_PUBLICATION_SCHEMA_VERSION,
        key: artifactKey,
        pointerKey: landingPublicationKey(landing.slug),
        artifactKey,
        model,
      }
    : null;
}

export async function publishLandingPublication(
  db: D1Database,
  bucket: R2Bucket,
  landing: LandingRecord,
): Promise<LandingPublication> {
  const publication = await buildLandingPublication(db, landing);
  if (!publication) {
    throw new Error('LANDING_PUBLICATION_BUILD_FAILED');
  }
  await bucket.put(publication.key, JSON.stringify(publication), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: LANDING_PUBLICATION_CACHE_CONTROL,
    },
    customMetadata: {
      publicationType: 'landing',
      schemaVersion: String(LANDING_PUBLICATION_SCHEMA_VERSION),
      slug: landing.slug,
    },
  });
  const pointer: LandingPublicationPointer = {
    schemaVersion: LANDING_PUBLICATION_SCHEMA_VERSION,
    slug: landing.slug,
    artifactKey: publication.artifactKey,
    publishedAt: landing.publishedAt ?? new Date().toISOString(),
  };
  await bucket.put(publication.pointerKey, JSON.stringify(pointer), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=30, must-revalidate',
    },
    customMetadata: {
      publicationType: 'landing-pointer',
      schemaVersion: String(LANDING_PUBLICATION_SCHEMA_VERSION),
      slug: landing.slug,
    },
  });
  return publication;
}

export async function revokeLandingPublication(
  bucket: R2Bucket,
  slug: string,
): Promise<void> {
  await bucket.delete(landingPublicationKey(slug));
}
