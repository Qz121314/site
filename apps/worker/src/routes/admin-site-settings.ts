import { Hono } from 'hono';
import { createAuditLogStatement, writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import { buildMediaUrl } from '../media/media-url';
import {
  BOTTOM_NAVIGATION_KEYS,
  createReplaceBottomNavigationStatements,
  getBottomNavigation,
  getReadyBottomNavigationAssets,
  validateBottomNavigationInput,
  type BottomNavigationInput,
} from '../settings/bottom-navigation';
import {
  createReplaceHomeLayoutStatements,
  getActiveHomeSectionIds,
  getHomeLayout,
  validateHomeLayoutInput,
} from '../settings/home-layout';
import {
  createReplaceHeroSlideStatements,
  getReadyHeroMediaAssets,
  getSiteHeroSlides,
  resolveHeroSlides,
  validateHeroSlidesInput,
  type SiteHeroSlideInput,
} from '../settings/site-hero';
import {
  createUpdateSiteSettingsStatement,
  getSiteSettings,
  normalizeMediaBaseUrl,
  toSiteSettings,
  validateSiteSettingsInput,
} from '../settings/site-settings';
import type { AppEnvironment } from '../types';

const ADMIN_REQUEST_HEADER = 'x-admin-request';
const DOMAIN_PROBE_PREFIX = 'system/domain-probes';

type MediaDomainTestBody = {
  mediaBaseUrl: unknown;
};

type ReadyImageAsset = {
  object_key: string;
};

function hasAdminRequestHeader(context: Parameters<typeof apiError>[0]): boolean {
  return context.req.header(ADMIN_REQUEST_HEADER) === '1';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonBody(context: Parameters<typeof apiError>[0]): Promise<unknown> {
  const contentType = context.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new Error('INVALID_CONTENT_TYPE');
  }

  try {
    return await context.req.json<unknown>();
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function parseMediaDomainTestBody(value: unknown): MediaDomainTestBody | null {
  if (!isRecord(value) || !('mediaBaseUrl' in value)) return null;
  return { mediaBaseUrl: value.mediaBaseUrl };
}

function heroInputFromCurrent(
  slides: Awaited<ReturnType<typeof getSiteHeroSlides>>,
): SiteHeroSlideInput[] {
  return slides.map((slide) => ({
    id: slide.id,
    mediaAssetId: slide.mediaAssetId,
    title: slide.title,
    description: slide.description,
    ctaLabel: slide.ctaLabel,
    ctaHref: slide.ctaHref,
    sortOrder: slide.sortOrder,
  }));
}

function navigationInputFromCurrent(
  items: Awaited<ReturnType<typeof getBottomNavigation>>,
): BottomNavigationInput {
  return items.map(({ sortOrder: _sortOrder, ...item }) => item);
}

function resolvedNavigation(input: BottomNavigationInput) {
  const byKey = new Map(input.map((item) => [item.key, item]));
  return BOTTOM_NAVIGATION_KEYS.map((key, sortOrder) => {
    const item = byKey.get(key);
    if (!item) throw new Error('BOTTOM_NAVIGATION_MISSING');
    return { ...item, sortOrder };
  });
}

async function getReadyImageAsset(
  db: D1Database,
  id: string,
): Promise<ReadyImageAsset | null> {
  return db
    .prepare(
      `SELECT object_key
       FROM media_assets
       WHERE id = ?
         AND status = 'ready'
         AND deleted_at IS NULL
         AND mime_type LIKE 'image/%'`,
    )
    .bind(id)
    .first<ReadyImageAsset>();
}

export const adminSiteSettingsRoutes = new Hono<AppEnvironment>();

adminSiteSettingsRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  const settings = await getSiteSettings(context.env.DB);
  const [heroSlides, bottomNavigation, homeLayout] = await Promise.all([
    getSiteHeroSlides(context.env.DB, settings.mediaBaseUrl),
    getBottomNavigation(context.env.DB),
    getHomeLayout(context.env.DB),
  ]);
  return context.json({
    settings: { ...settings, heroSlides, bottomNavigation, homeLayout },
  });
});

adminSiteSettingsRoutes.put('/', async (context) => {
  context.header('Cache-Control', 'no-store');

  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return apiError(
      context,
      400,
      error instanceof Error && error.message === 'INVALID_CONTENT_TYPE'
        ? 'INVALID_CONTENT_TYPE'
        : 'INVALID_JSON',
      error instanceof Error && error.message === 'INVALID_CONTENT_TYPE'
        ? '站点设置请求必须使用 JSON。'
        : '站点设置请求 JSON 无效。',
    );
  }

  const validation = validateSiteSettingsInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_SITE_SETTINGS', validation.message, {
      field: validation.field,
    });
  }

  const heroValidation = validateHeroSlidesInput(
    isRecord(body) ? body.heroSlides : undefined,
  );
  if (!heroValidation.ok) {
    return apiError(context, 400, 'INVALID_SITE_HERO', heroValidation.message, {
      field: heroValidation.field,
    });
  }

  const navigationValidation = validateBottomNavigationInput(
    isRecord(body) ? body.bottomNavigation : undefined,
  );
  if (!navigationValidation.ok) {
    return apiError(
      context,
      400,
      'INVALID_BOTTOM_NAVIGATION',
      navigationValidation.message,
      {
        field: navigationValidation.field,
      },
    );
  }

  const homeLayoutValidation = validateHomeLayoutInput(
    isRecord(body) ? body.homeLayout : undefined,
  );
  if (!homeLayoutValidation.ok) {
    return apiError(context, 400, 'INVALID_HOME_LAYOUT', homeLayoutValidation.message, {
      field: homeLayoutValidation.field,
    });
  }

  const logoAsset = validation.value.logoAssetId
    ? await getReadyImageAsset(context.env.DB, validation.value.logoAssetId)
    : null;
  if (validation.value.logoAssetId && !logoAsset) {
    return apiError(
      context,
      409,
      'LOGO_ASSET_INVALID',
      'Logo 图片不存在、已删除或状态异常。',
      {
        field: 'logoAssetId',
      },
    );
  }

  const currentSettings = await getSiteSettings(context.env.DB);
  const [currentBottomNavigation, currentHomeLayout] = await Promise.all([
    getBottomNavigation(context.env.DB),
    getHomeLayout(context.env.DB),
  ]);
  const bottomNavigationInput = navigationValidation.provided
    ? navigationValidation.value
    : navigationInputFromCurrent(currentBottomNavigation);
  const homeLayoutInput = homeLayoutValidation.provided
    ? homeLayoutValidation.value
    : currentHomeLayout;

  const selectedHomeSectionIds = [
    ...homeLayoutInput.shortcutSectionIds,
    ...homeLayoutInput.recommendationSectionIds,
  ];
  const activeHomeSectionIds = await getActiveHomeSectionIds(
    context.env.DB,
    selectedHomeSectionIds,
  );
  if (activeHomeSectionIds.size !== new Set(selectedHomeSectionIds).size) {
    return apiError(
      context,
      409,
      'HOME_SECTION_INVALID',
      '首页选择的分区不存在、已停用或已进入回收站，请重新选择。',
      { field: 'homeLayout' },
    );
  }

  const navigationAssetIds = bottomNavigationInput
    .filter((item) => item.iconType === 'asset' && item.iconAssetId)
    .map((item) => item.iconAssetId as string);
  const navigationAssets = await getReadyBottomNavigationAssets(
    context.env.DB,
    navigationAssetIds,
  );
  if (navigationAssets.size !== new Set(navigationAssetIds).size) {
    return apiError(
      context,
      409,
      'BOTTOM_NAVIGATION_ASSET_INVALID',
      '底部导航图片不存在、已删除或状态异常，请重新选择。',
      { field: 'bottomNavigation' },
    );
  }

  const currentHeroSlides = await getSiteHeroSlides(
    context.env.DB,
    currentSettings.mediaBaseUrl,
  );
  const heroInput = heroValidation.provided
    ? heroValidation.value
    : heroInputFromCurrent(currentHeroSlides);
  const heroAssets = await getReadyHeroMediaAssets(
    context.env.DB,
    heroInput.map((slide) => slide.mediaAssetId),
  );
  if (heroAssets.size !== heroInput.length) {
    return apiError(
      context,
      409,
      'HERO_ASSET_INVALID',
      'Hero 素材不存在、已删除或状态异常，请重新选择。',
      { field: 'heroSlides' },
    );
  }

  const updatedAt = new Date().toISOString();
  const resolvedHeroSlides = resolveHeroSlides(
    heroInput,
    heroAssets,
    validation.value.mediaBaseUrl,
  );
  const updated = {
    ...toSiteSettings(validation.value, logoAsset?.object_key ?? null, updatedAt),
    heroSlides: resolvedHeroSlides,
    bottomNavigation: resolvedNavigation(bottomNavigationInput),
    homeLayout: homeLayoutInput,
  };
  const current = {
    ...currentSettings,
    heroSlides: currentHeroSlides,
    bottomNavigation: currentBottomNavigation,
    homeLayout: currentHomeLayout,
  };
  const statements: D1PreparedStatement[] = [
    createUpdateSiteSettingsStatement(context.env.DB, validation.value, updatedAt),
  ];
  if (heroValidation.provided) {
    statements.push(
      ...createReplaceHeroSlideStatements(
        context.env.DB,
        heroValidation.value,
        updatedAt,
      ),
    );
  }
  if (navigationValidation.provided) {
    statements.push(
      ...createReplaceBottomNavigationStatements(
        context.env.DB,
        navigationValidation.value,
        updatedAt,
      ),
    );
  }
  if (homeLayoutValidation.provided) {
    statements.push(
      ...createReplaceHomeLayoutStatements(
        context.env.DB,
        homeLayoutValidation.value,
        updatedAt,
      ),
    );
  }
  statements.push(
    createAuditLogStatement(context.env.DB, {
      action: 'site_settings.updated',
      entityType: 'site_settings',
      entityId: '1',
      requestId: context.get('requestId'),
      before: { ...current },
      after: { ...updated },
      createdAt: updatedAt,
    }),
  );

  await context.env.DB.batch(statements);
  return context.json({ settings: updated });
});

adminSiteSettingsRoutes.post('/media-domain/test', async (context) => {
  context.header('Cache-Control', 'no-store');

  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return apiError(
      context,
      400,
      error instanceof Error && error.message === 'INVALID_CONTENT_TYPE'
        ? 'INVALID_CONTENT_TYPE'
        : 'INVALID_JSON',
      error instanceof Error && error.message === 'INVALID_CONTENT_TYPE'
        ? '域名测试请求必须使用 JSON。'
        : '域名测试请求 JSON 无效。',
    );
  }

  const input = parseMediaDomainTestBody(body);
  if (!input) {
    return apiError(context, 400, 'INVALID_MEDIA_DOMAIN', '请填写 R2 自定义域名。');
  }

  let mediaBaseUrl: string | null;
  try {
    mediaBaseUrl = normalizeMediaBaseUrl(input.mediaBaseUrl);
  } catch (error) {
    return apiError(
      context,
      400,
      'INVALID_MEDIA_DOMAIN',
      error instanceof Error ? error.message : 'R2 自定义域名无效。',
    );
  }

  if (!mediaBaseUrl) {
    return apiError(context, 400, 'INVALID_MEDIA_DOMAIN', '请填写 R2 自定义域名。');
  }

  const probeId = crypto.randomUUID();
  const objectKey = `${DOMAIN_PROBE_PREFIX}/${probeId}.txt`;
  const probeValue = `service-catalog-site:${probeId}`;
  const publicUrl = buildMediaUrl(mediaBaseUrl, objectKey);
  let responseStatus: number | null = null;

  try {
    await context.env.ASSETS_BUCKET.put(objectKey, probeValue, {
      httpMetadata: {
        contentType: 'text/plain; charset=utf-8',
        cacheControl: 'no-store',
      },
    });

    const response = await fetch(publicUrl, {
      method: 'GET',
      headers: { 'cache-control': 'no-cache' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    responseStatus = response.status;

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      throw new Error(
        location
          ? `自定义域名发生 HTTP ${response.status} 跳转：${location}`
          : `自定义域名发生 HTTP ${response.status} 跳转。`,
      );
    }

    if (!response.ok) {
      throw new Error(`自定义域名返回 HTTP ${response.status}。`);
    }

    const responseBody = await response.text();
    if (responseBody !== probeValue) {
      throw new Error('自定义域名返回的对象内容不匹配。');
    }

    await writeAuditLog(context.env.DB, {
      action: 'site_settings.media_domain.test_succeeded',
      entityType: 'site_settings',
      entityId: '1',
      requestId: context.get('requestId'),
      metadata: { mediaBaseUrl, responseStatus },
    });

    return context.json({
      connected: true,
      mediaBaseUrl,
      probeUrl: publicUrl,
      responseStatus,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '无法通过 R2 自定义域名读取测试对象。';

    await writeAuditLog(context.env.DB, {
      action: 'site_settings.media_domain.test_failed',
      entityType: 'site_settings',
      entityId: '1',
      requestId: context.get('requestId'),
      metadata: { mediaBaseUrl, responseStatus, message },
    });

    return apiError(context, 400, 'MEDIA_DOMAIN_TEST_FAILED', message, {
      responseStatus: responseStatus ?? 0,
    });
  } finally {
    await context.env.ASSETS_BUCKET.delete(objectKey);
  }
});
