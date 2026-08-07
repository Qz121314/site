import { Hono } from 'hono';
import { apiError } from '../http/api-response';
import {
  getModularPublishStatus,
  ModularPublicationError,
  normalizePublishModuleKey,
  publishModularStorefront,
  rollbackModularModule,
} from '../publishing/modular-publisher';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader, isRecord } from './admin-section-shared';

export const adminPublishRoutes = new Hono<AppEnvironment>();

adminPublishRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  try {
    return context.json({ status: await getModularPublishStatus(context.env.DB, context.env.ASSETS_BUCKET) });
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
    return apiError(context, 400, 'INVALID_PUBLISH_VERSION', '请选择需要回退的板块版本。');
  }
  if (
    !isRecord(body) ||
    typeof body.moduleKey !== 'string' ||
    typeof body.contentVersion !== 'string'
  ) {
    return apiError(context, 400, 'INVALID_PUBLISH_VERSION', '请选择需要回退的板块版本。');
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
