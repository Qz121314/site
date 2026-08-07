import { Hono } from 'hono';
import {
  createMarkMediaAssetDeletedStatement,
  createRestoreMediaAssetStatement,
  evaluateCleanupCandidates,
  isValidR2ObjectKey,
  scanAssetPage,
} from '../assets/asset-library';
import { createAuditLogStatement, writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createIdempotencyStatement,
  normalizeIdempotencyKey,
  readIdempotentResponse,
} from '../idempotency/idempotency';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  isRecord,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 500;
const MAX_CLEANUP_SIZE = 100;
const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const CLEANUP_SCOPE = 'assets.cleanup';

function parsePageSize(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PAGE_SIZE;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_PAGE_SIZE
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseCleanupKeys(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.keys)) {
    return null;
  }

  const keys = value.keys.filter(
    (key): key is string => typeof key === 'string' && isValidR2ObjectKey(key),
  );
  if (keys.length === 0 || keys.length !== value.keys.length || keys.length > MAX_CLEANUP_SIZE) {
    return null;
  }

  const uniqueKeys = [...new Set(keys)];
  return uniqueKeys.length === keys.length ? uniqueKeys : null;
}

function buildPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export const adminAssetRoutes = new Hono<AppEnvironment>();

adminAssetRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');

  const cursor = context.req.query('cursor') || undefined;
  const limit = parsePageSize(context.req.query('limit'));
  const page = await scanAssetPage(context.env.ASSETS_BUCKET, context.env.DB, {
    ...(cursor ? { cursor } : {}),
    limit,
  });

  return context.json({
    ...page,
    scannedCount: page.assets.length,
  });
});

adminAssetRoutes.post('/cleanup', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量清理缺少幂等键。');
  }

  const now = new Date().toISOString();
  const prior = await readIdempotentResponse(
    context.env.DB,
    CLEANUP_SCOPE,
    idempotencyKey,
    now,
  );
  if (isRecord(prior)) {
    return context.json(prior);
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }

  const keys = parseCleanupKeys(body);
  if (!keys) {
    return apiError(
      context,
      400,
      'INVALID_ASSET_KEYS',
      `请选择 1 到 ${MAX_CLEANUP_SIZE} 个有效的 R2 图片对象。`,
    );
  }

  const evaluations = await evaluateCleanupCandidates(
    context.env.ASSETS_BUCKET,
    context.env.DB,
    keys,
  );
  const blocked = evaluations.find((item) => item.blockedReason !== null);
  if (blocked) {
    return apiError(
      context,
      409,
      'ASSET_CLEANUP_BLOCKED',
      '部分图片仍在使用、仍受最近 3 个可回退快照保护或不是图片，请重新扫描。',
      {
        blockedKey: blocked.key,
        blockedReason: blocked.blockedReason ?? 'UNKNOWN',
      },
    );
  }

  const tracked = evaluations.filter(
    (item): item is typeof item & { row: NonNullable<typeof item.row> } => item.row !== null,
  );
  const markResults = tracked.length
    ? await context.env.DB.batch(
        tracked.map((item) =>
          createMarkMediaAssetDeletedStatement(context.env.DB, item.row, now),
        ),
      )
    : [];

  const changedRows = markResults.flatMap((result, index) => {
    const item = tracked[index];
    return result.meta.changes === 1 && item ? [item.row] : [];
  });
  if (changedRows.length !== tracked.length) {
    if (changedRows.length > 0) {
      await context.env.DB.batch(
        changedRows.map((row) => createRestoreMediaAssetStatement(context.env.DB, row, now)),
      );
    }

    return apiError(
      context,
      409,
      'ASSET_REFERENCE_CHANGED',
      '图片引用在清理前发生变化，已停止本次操作，请重新扫描。',
    );
  }

  const existing = evaluations.filter(
    (item): item is typeof item & { object: NonNullable<typeof item.object> } => item.object !== null,
  );

  try {
    if (existing.length > 0) {
      await context.env.ASSETS_BUCKET.delete(existing.map((item) => item.key));
    }
  } catch (error) {
    const restoreStatements = tracked.map((item) =>
      createRestoreMediaAssetStatement(context.env.DB, item.row, now),
    );
    restoreStatements.push(
      createAuditLogStatement(context.env.DB, {
        action: 'asset.cleanup.failed',
        entityType: 'r2_asset_batch',
        entityId: idempotencyKey,
        requestId: context.get('requestId'),
        metadata: {
          keys,
          error: error instanceof Error ? error.message : 'R2_DELETE_FAILED',
        },
      }),
    );
    await context.env.DB.batch(restoreStatements);

    return apiError(context, 503, 'R2_DELETE_FAILED', 'R2 图片物理删除失败，数据库状态已恢复。');
  }

  const responseBody = {
    deletedKeys: keys,
    deletedCount: keys.length,
    alreadyMissingCount: keys.length - existing.length,
    freedBytes: existing.reduce((total, item) => total + item.object.size, 0),
  };

  try {
    await context.env.DB.batch([
      createAuditLogStatement(context.env.DB, {
        action: 'asset.cleanup.completed',
        entityType: 'r2_asset_batch',
        entityId: idempotencyKey,
        requestId: context.get('requestId'),
        metadata: {
          ...responseBody,
          trackedCount: tracked.length,
          untrackedCount: keys.length - tracked.length,
          physicalDelete: true,
          snapshotRetentionChecked: true,
        },
        createdAt: now,
      }),
      context.env.DB
        .prepare(
          `DELETE FROM asset_cleanup_guards
           WHERE object_key IN (${buildPlaceholders(keys.length)})`,
        )
        .bind(...keys),
      createIdempotencyStatement(
        context.env.DB,
        CLEANUP_SCOPE,
        idempotencyKey,
        responseBody,
        now,
      ),
    ]);
  } catch (error) {
    await writeAuditLog(context.env.DB, {
      action: 'asset.cleanup.reconciliation-required',
      entityType: 'r2_asset_batch',
      entityId: idempotencyKey,
      requestId: context.get('requestId'),
      metadata: {
        keys,
        error: error instanceof Error ? error.message : 'D1_FINALIZE_FAILED',
      },
    });
    throw error;
  }

  return context.json(responseBody);
});
