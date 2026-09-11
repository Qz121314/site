import {
  buildLandingModel,
  validateLandingDependencies,
  type LandingBuildModel,
  type LandingRecord,
} from '../landing/landing-pages';

export const LANDING_PUBLICATION_SCHEMA_VERSION = 1;
export const LANDING_PUBLICATION_PREFIX = 'landing-publication/v1';

export function landingPublicationKey(slug: string): string {
  return `${LANDING_PUBLICATION_PREFIX}/${slug}.json`;
}

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
): Promise<{ schemaVersion: number; key: string; model: LandingBuildModel } | null> {
  const validation = await validateLandingPublication(db, landing);
  if (!validation.ok) return null;
  const model = await buildLandingModel(db, landing);
  return model
    ? {
        schemaVersion: LANDING_PUBLICATION_SCHEMA_VERSION,
        key: landingPublicationKey(landing.slug),
        model,
      }
    : null;
}
