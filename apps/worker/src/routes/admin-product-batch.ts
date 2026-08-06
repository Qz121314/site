import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createIdempotencyStatement,
  normalizeIdempotencyKey,
  readIdempotentResponse,
} from '../idempotency/idempotency';
import {
  createDeleteProductStatement,
  createReorderProductStatement,
  getProduct,
} from '../products/products';
import { getSection } from '../sections/sections';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader, isRecord, jsonBodyError, readJsonBody } from './admin-section-shared';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const MAX_BATCH_SIZE = 100;

function parseIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null;
  const ids = value.ids.filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100,
  );
  if (ids.length === 0 || ids.length !== value.ids.length || ids.length > MAX_BATCH_SIZE) {
    return null;
  }
  return new Set(ids).size === ids.length ? ids : null;
}

function parseReorderItems(value: unknown): Array<{ id: string; sortOrder: number }> | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (value.items.length === 0 || value.items.length > MAX_BATCH_SIZE) return null;
  const items: Array<{ id: string; sortOrder: number }> = [];
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !item.id ||
      typeof item.sortOrder !== 'number' ||
      !Number.isInteger(item.sortOrder) ||
      item.sortOrder < 0 ||
      item.sortOrder > 1_000_000
    ) {
      return null;
    }
    items.push({ id: item.id, sortOrder: item.sortOrder });
  }
  return new Set(items.map((item) => item.id)).size === items.length ? items : null;
}

async function requireSection(
  context: Parameters<typeof apiError>[0],
  sectionId: string,
): Promise<ReturnType<typeof apiError> | null> {
  const section = await getSection(context.env.DB, sectionId);
  if (!section || section.deletedAt) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '分区不存在或已进入回收站。');
  }
  return null;
}

export const adminProductBatchRoutes = new Hono<AppEnvironment>();

adminProductBatchRoutes.post('/:sectionId/products/batch-delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;

  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除需要有效的幂等键。');
  }
  const now = new Date().toISOString();
  const scope = `product-batch-delete:${sectionId}`;
  const previous = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
  if (previous) return context.json(previous);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const ids = parseIds(body);
  if (!ids) {
    return apiError(context, 400, 'INVALID_PRODUCT_BATCH', '请选择 1 到 100 个有效产品。');
  }

  const products = await Promise.all(ids.map((id) => getProduct(context.env.DB, sectionId, id)));
  const missingIndex = products.findIndex((product) => !product || product.deletedAt);
  if (missingIndex >= 0) {
    return apiError(
      context,
      404,
      'PRODUCT_NOT_FOUND',
      `产品 ${ids[missingIndex]} 不存在或已进入回收站。`,
    );
  }

  const response = { deletedIds: ids };
  const statements = products.flatMap((product, index) => {
    const current = product!;
    return [
      createDeleteProductStatement(context.env.DB, sectionId, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'product.deleted',
        entityType: 'product',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: { ...current, deletedAt: now, updatedAt: now },
        metadata: { sectionId, batchIndex: index, batchSize: ids.length },
        createdAt: now,
      }),
    ];
  });
  statements.push(
    createIdempotencyStatement(context.env.DB, scope, idempotencyKey, response, now),
  );
  await context.env.DB.batch(statements);
  return context.json(response);
});

adminProductBatchRoutes.post('/:sectionId/products/reorder', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;

  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '产品排序需要有效的幂等键。');
  }
  const now = new Date().toISOString();
  const scope = `product-reorder:${sectionId}`;
  const previous = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
  if (previous) return context.json(previous);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const items = parseReorderItems(body);
  if (!items) {
    return apiError(context, 400, 'INVALID_PRODUCT_REORDER', '产品排序数据无效。');
  }

  const products = await Promise.all(
    items.map((item) => getProduct(context.env.DB, sectionId, item.id)),
  );
  if (products.some((product) => !product || product.deletedAt)) {
    return apiError(context, 404, 'PRODUCT_NOT_FOUND', '部分产品不存在或已进入回收站。');
  }

  const response = { reordered: true };
  const statements = items.flatMap((item, index) => {
    const current = products[index]!;
    return [
      createReorderProductStatement(context.env.DB, sectionId, item.id, item.sortOrder, now),
      createAuditLogStatement(context.env.DB, {
        action: 'product.reordered',
        entityType: 'product',
        entityId: item.id,
        requestId: context.get('requestId'),
        before: { sortOrder: current.sortOrder },
        after: { sortOrder: item.sortOrder },
        metadata: { sectionId },
        createdAt: now,
      }),
    ];
  });
  statements.push(
    createIdempotencyStatement(context.env.DB, scope, idempotencyKey, response, now),
  );
  await context.env.DB.batch(statements);
  return context.json(response);
});
