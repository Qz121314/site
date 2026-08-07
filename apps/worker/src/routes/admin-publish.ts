import { Hono } from 'hono';
import { apiError } from '../http/api-response';
import { prunePublishRetention } from '../publishing/publish-retention';
import {
  getPublishStatus,
  PublicationError,
  publishSnapshot,
} from '../publishing/snapshot-publisher';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader } from './admin-section-shared';

export const adminPublishRoutes = new Hono<AppEnvironment>();

async function pruneHistoryBestEffort(context: Parameters<typeof apiError>[0]): Promise<void> {
  try {
    const result = await prunePublishRetention(context.env.DB, context.env.ASSETS_BUCKET);
    if (
      result.removedVersionRecords > 0 ||
      result.removedJobRecords > 0 ||
      result.removedR2Objects > 0
    ) {
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'storefront.publish.retention_pruned',
          requestId: context.get('requestId'),
          retainedVersions: result.retainedVersions,
          removedVersionRecords: result.removedVersionRecords,
          removedJobRecords: result.removedJobRecords,
          removedR2Objects: result.removedR2Objects,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'storefront.publish.retention_failed',
        requestId: context.get('requestId'),
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown retention error',
      }),
    );
  }
}

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
    await pruneHistoryBestEffort(context);
    return context.json({ publication }, 201);
  } catch (error) {
    await pruneHistoryBestEffort(context);
    if (error instanceof PublicationError) {
      return apiError(context, 409, error.code, error.message);
    }
    throw error;
  }
});
