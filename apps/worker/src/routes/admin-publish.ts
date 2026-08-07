import { Hono } from 'hono';
import { apiError } from '../http/api-response';
import { prunePublishRetention } from '../publishing/publish-retention';
import {
  computeStorefrontStateRevision,
  listPublishVersions,
  PublishStateError,
  rollbackStorefrontVersion,
  setPublishVersionStateRevision,
} from '../publishing/publish-state';
import {
  getPublishStatus,
  PublicationError,
  publishSnapshot,
} from '../publishing/snapshot-publisher';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader, isRecord } from './admin-section-shared';

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

function publicVersion(version: Awaited<ReturnType<typeof listPublishVersions>>[number]) {
  return {
    contentVersion: version.contentVersion,
    publishedAt: version.publishedAt,
    isCurrent: version.isCurrent,
    objectCount: version.objectCount,
    totalBytes: version.totalBytes,
  };
}

adminPublishRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  const [baseStatus, stateRevision, versions] = await Promise.all([
    getPublishStatus(context.env.DB, context.env.ASSETS_BUCKET),
    computeStorefrontStateRevision(context.env.DB),
    listPublishVersions(context.env.DB),
  ]);
  const currentVersion = versions.find(
    (version) => version.isCurrent && version.contentVersion === baseStatus.currentVersion,
  );

  return context.json({
    status: {
      ...baseStatus,
      isCurrent: Boolean(
        currentVersion?.stateRevision && currentVersion.stateRevision === stateRevision,
      ),
      versions: versions.map(publicVersion),
    },
  });
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
    return apiError(context, 400, 'INVALID_PUBLISH_VERSION', '请选择需要回退的前台版本。');
  }
  if (!isRecord(body) || typeof body.contentVersion !== 'string') {
    return apiError(context, 400, 'INVALID_PUBLISH_VERSION', '请选择需要回退的前台版本。');
  }
  const contentVersion = body.contentVersion.trim();
  if (!contentVersion || contentVersion.length > 160 || !/^[A-Za-z0-9-]+$/u.test(contentVersion)) {
    return apiError(context, 400, 'INVALID_PUBLISH_VERSION', '前台版本标识无效。');
  }

  try {
    const version = await rollbackStorefrontVersion(
      context.env.DB,
      context.env.ASSETS_BUCKET,
      contentVersion,
      context.get('requestId'),
    );
    return context.json({ version: publicVersion(version) });
  } catch (error) {
    if (error instanceof PublishStateError) {
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

  try {
    const stateRevision = await computeStorefrontStateRevision(context.env.DB);
    const [baseStatus, versions] = await Promise.all([
      getPublishStatus(context.env.DB, context.env.ASSETS_BUCKET),
      listPublishVersions(context.env.DB),
    ]);
    const currentVersion = versions.find(
      (version) => version.isCurrent && version.contentVersion === baseStatus.currentVersion,
    );

    if (currentVersion?.stateRevision === stateRevision) {
      return context.json({
        publication: {
          jobId: currentVersion.publishJobId,
          contentVersion: currentVersion.contentVersion,
          sourceRevision: currentVersion.sourceRevision,
          publishedAt: currentVersion.publishedAt,
          objectCount: currentVersion.objectCount,
          totalBytes: currentVersion.totalBytes,
          unchanged: true,
        },
      });
    }

    const publication = await publishSnapshot(
      context.env.DB,
      context.env.ASSETS_BUCKET,
      context.get('requestId'),
    );
    try {
      await setPublishVersionStateRevision(
        context.env.DB,
        publication.contentVersion,
        stateRevision,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'storefront.publish.state_revision_write_failed',
          requestId: context.get('requestId'),
          contentVersion: publication.contentVersion,
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : 'Unknown state revision write failure',
        }),
      );
    }
    await pruneHistoryBestEffort(context);
    return context.json({ publication: { ...publication, unchanged: false } }, 201);
  } catch (error) {
    await pruneHistoryBestEffort(context);
    if (error instanceof PublicationError || error instanceof PublishStateError) {
      return apiError(context, error.status, error.code, error.message);
    }
    throw error;
  }
});
