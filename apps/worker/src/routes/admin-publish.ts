import { Hono } from 'hono';
import { apiError } from '../http/api-response';
import {
  getModularPublishStatus,
  ModularPublicationError,
  normalizePublishModuleKey,
  publishModularStorefront,
  rollbackModularModule,
} from '../publishing/storefront-publisher';
import { getLanding } from '../landing/landing-pages';
import { publishLandingPublication } from '../publishing/landing-publisher';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader, isRecord } from './admin-section-shared';

export const adminPublishRoutes = new Hono<AppEnvironment>();

adminPublishRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  try {
    return context.json({
      status: await getModularPublishStatus(context.env.DB, context.env.ASSETS_BUCKET),
    });
  } catch (error) {
    if (error instanceof ModularPublicationError) {
      return apiError(context, error.status, error.code, error.message);
    }
    throw error;
  }
});

adminPublishRoutes.post('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let moduleKey = 'all';
  const contentLength = context.req.header('content-length');
  if (contentLength && contentLength !== '0') {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return apiError(context, 400, 'INVALID_MODULE', '请选择有效的发布板块。');
    }
    if (!isRecord(body)) {
      return apiError(context, 400, 'INVALID_MODULE', '请选择有效的发布板块。');
    }
    const normalized = normalizePublishModuleKey(body.moduleKey);
    if (!normalized) {
      return apiError(context, 400, 'INVALID_MODULE', '请选择有效的发布板块。');
    }
    moduleKey = normalized;
  }

  try {
    const publication = await publishModularStorefront(
      context.env.DB,
      context.env.ASSETS_BUCKET,
      context.get('requestId'),
      moduleKey,
    );
    const changed = publication.publications.some((item) => !item.unchanged);
    return context.json({ publication }, changed ? 201 : 200);
  } catch (error) {
    if (error instanceof ModularPublicationError) {
      return apiError(context, error.status, error.code, error.message);
    }
    throw error;
  }
});

adminPublishRoutes.post('/rollback', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return apiError(
      context,
      400,
      'INVALID_PUBLISH_VERSION',
      '请选择需要回退的板块版本。',
    );
  }
  if (
    !isRecord(body) ||
    typeof body.moduleKey !== 'string' ||
    typeof body.contentVersion !== 'string'
  ) {
    return apiError(
      context,
      400,
      'INVALID_PUBLISH_VERSION',
      '请选择需要回退的板块版本。',
    );
  }

  try {
    const version = await rollbackModularModule(
      context.env.DB,
      context.env.ASSETS_BUCKET,
      body.moduleKey,
      body.contentVersion,
      context.get('requestId'),
    );
    return context.json({ version });
  } catch (error) {
    if (error instanceof ModularPublicationError) {
      return apiError(context, error.status, error.code, error.message);
    }
    throw error;
  }
});

adminPublishRoutes.post('/landings/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const landing = await getLanding(context.env.DB, context.req.param('id'));
  if (!landing || landing.deletedAt) {
    return apiError(context, 404, 'LANDING_NOT_FOUND', '落地页不存在或已进入回收站。');
  }
  if (landing.status !== 'published') {
    return apiError(
      context,
      409,
      'LANDING_NOT_PUBLISHABLE',
      '只有已发布落地页可以生成 publication。',
    );
  }
  try {
    const publication = await publishLandingPublication(
      context.env.DB,
      context.env.ASSETS_BUCKET,
      landing,
    );
    return context.json({ publication }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('LANDING_')) {
      return apiError(context, 409, error.message, '落地页 publication 生成失败。');
    }
    throw error;
  }
});
