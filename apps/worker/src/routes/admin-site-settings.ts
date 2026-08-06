import { Hono } from 'hono';
import { createAuditLogStatement, writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import { buildMediaUrl } from '../media/media-url';
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
  if (!isRecord(value) || !('mediaBaseUrl' in value)) {
    return null;
  }

  return { mediaBaseUrl: value.mediaBaseUrl };
}

export const adminSiteSettingsRoutes = new Hono<AppEnvironment>();

adminSiteSettingsRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  const settings = await getSiteSettings(context.env.DB);
  return context.json({ settings });
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

  const current = await getSiteSettings(context.env.DB);
  const updatedAt = new Date().toISOString();
  const updated = toSiteSettings(validation.value, current.logoAssetId, updatedAt);

  await context.env.DB.batch([
    createUpdateSiteSettingsStatement(context.env.DB, validation.value, updatedAt),
    createAuditLogStatement(context.env.DB, {
      action: 'site_settings.updated',
      entityType: 'site_settings',
      entityId: '1',
      requestId: context.get('requestId'),
      before: { ...current },
      after: { ...updated },
      createdAt: updatedAt,
    }),
  ]);

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
      metadata: {
        mediaBaseUrl,
        responseStatus,
      },
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
      metadata: {
        mediaBaseUrl,
        responseStatus,
        message,
      },
    });

    return apiError(context, 400, 'MEDIA_DOMAIN_TEST_FAILED', message, {
      responseStatus: responseStatus ?? 0,
    });
  } finally {
    await context.env.ASSETS_BUCKET.delete(objectKey);
  }
});
