import { Hono } from 'hono';
import { apiError } from '../http/api-response';
import {
  getPublishStatus,
  PublicationError,
  publishSnapshot,
} from '../publishing/snapshot-publisher';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader } from './admin-section-shared';

export const adminPublishRoutes = new Hono<AppEnvironment>();

adminPublishRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ status: await getPublishStatus(context.env.DB, context.env.ASSETS_BUCKET) });
});

adminPublishRoutes.post('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  try {
    const publication = await publishSnapshot(
      context.env.DB,
      context.env.ASSETS_BUCKET,
      context.get('requestId'),
    );
    return context.json({ publication }, 201);
  } catch (error) {
    if (error instanceof PublicationError) {
      return apiError(context, 409, error.code, error.message);
    }
    throw error;
  }
});
