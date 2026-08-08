import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createIdempotencyStatement,
  normalizeIdempotencyKey,
  readIdempotentResponse,
} from '../idempotency/idempotency';
import { deleteManagedMediaAssets } from '../media/media-delete';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader, isRecord, jsonBodyError, readJsonBody } from './admin-section-shared';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const DELETE_SCOPE = 'media-center.delete';
const MAX_DELETE_SIZE = 100;

function parseIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null;
  const ids = value.ids.filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100,
  );
  if (ids.length < 1 || ids.length > MAX_DELETE_SIZE || ids.length !== value.ids.length) return null;
  return new Set(ids).size === ids.length ? ids : null;
}

export const adminMediaDeleteRoutes = new Hono<AppEnvironment>();

adminMediaDeleteRoutes.post('/library/delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除素材缺少幂等键。');
  }

  const now = new Date().toISOString();
  const prior = await readIdempotentResponse(context.env.DB, DELETE_SCOPE, idempotencyKey, now);
  if (isRecord(prior)) return context.json(prior);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const ids = parseIds(body);
  if (!ids) {
    return apiError(context, 400, 'MEDIA_IDS_INVALID', `请选择 1 到 ${MAX_DELETE_SIZE} 个有效素材。`);
  }

  let deletion;
  try {
    deletion = await deleteManagedMediaAssets(
      context.env.ASSETS_BUCKET,
      context.env.DB,
      ids,
      now,
    );
  } catch (error) {
    return apiError(
      context,
      503,
      'R2_DELETE_FAILED',
      error instanceof Error ? `素材文件删除失败：${error.message}` : '素材文件删除失败。',
    );
  }

  if (!deletion.ok) {
    const message =
      deletion.blocked.reason === 'IN_USE'
        ? '部分素材仍被网站或产品引用，不能删除。'
        : deletion.blocked.reason === 'SNAPSHOT_RETENTION'
          ? '部分素材仍受可回退发布版本保护，暂不能删除。'
          : deletion.blocked.reason === 'REFERENCE_CHANGED'
            ? '素材引用状态在删除前发生变化，请刷新后重试。'
            : '部分素材已不存在，请刷新素材中心。';
    return apiError(context, 409, 'MEDIA_DELETE_BLOCKED', message, {
      blockedKey: deletion.blocked.id,
      blockedReason: deletion.blocked.reason,
    });
  }

  const responseBody = deletion.result;
  await context.env.DB.batch([
    createAuditLogStatement(context.env.DB, {
      action: 'media.deleted',
      entityType: 'media_asset_batch',
      entityId: idempotencyKey,
      requestId: context.get('requestId'),
      metadata: responseBody,
      createdAt: now,
    }),
    createIdempotencyStatement(
      context.env.DB,
      DELETE_SCOPE,
      idempotencyKey,
      responseBody,
      now,
    ),
  ]);

  return context.json(responseBody);
});
