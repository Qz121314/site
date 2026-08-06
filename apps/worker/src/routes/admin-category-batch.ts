import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  createDeleteCategoryStatement,
  createReorderCategoryStatement,
  getCategory,
  hasCategoryDependencies,
  type CategoryRecord,
} from '../categories/categories';
import { apiError } from '../http/api-response';
import {
  createIdempotencyStatement,
  normalizeIdempotencyKey,
  readIdempotentResponse,
} from '../idempotency/idempotency';
import { getSection } from '../sections/sections';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  isRecord,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const MAX_BATCH_SIZE = 100;

function parseBatchIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null;

  const ids = value.ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0 || ids.length !== value.ids.length || ids.length > MAX_BATCH_SIZE) {
    return null;
  }

  const uniqueIds = [...new Set(ids)];
  return uniqueIds.length === ids.length ? uniqueIds : null;
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

async function requireActiveSection(
  context: Parameters<typeof apiError>[0],
  sectionId: string,
): Promise<ReturnType<typeof apiError> | null> {
  const section = await getSection(context.env.DB, sectionId);
  if (!section || section.deletedAt) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '分区不存在或已进入回收站。');
  }
  return null;
}

function dependencyError(
  context: Parameters<typeof apiError>[0],
  category: CategoryRecord,
) {
  return apiError(
    context,
    409,
    'CATEGORY_HAS_PRODUCTS',
    `分类“${category.name}”仍被产品引用，不能删除。`,
    { productCount: category.productCount },
  );
}

export const adminCategoryBatchRoutes = new Hono<AppEnvironment>();

adminCategoryBatchRoutes.post('/:sectionId/categories/batch-delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const sectionId = context.req.param('sectionId');
  const sectionError = await requireActiveSection(context, sectionId);
  if (sectionError) return sectionError;

  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除缺少幂等键。');
  }

  const now = new Date().toISOString();
  const prior = await readIdempotentResponse(
    context.env.DB,
    `categories.batch-delete.${sectionId}`,
    idempotencyKey,
    now,
  );
  if (isRecord(prior)) return context.json(prior);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }

  const ids = parseBatchIds(body);
  if (!ids) {
    return apiError(context, 400, 'INVALID_CATEGORY_IDS', '请选择有效的分类。');
  }

  const categories = await Promise.all(
    ids.map((id) => getCategory(context.env.DB, sectionId, id)),
  );
  const activeCategories = categories.filter(
    (category): category is CategoryRecord => Boolean(category),
  );
  if (activeCategories.length !== ids.length || activeCategories.some((item) => item.deletedAt)) {
    return apiError(context, 404, 'CATEGORY_NOT_FOUND', '部分分类不存在或已进入回收站。');
  }

  const blocked = activeCategories.find(hasCategoryDependencies);
  if (blocked) return dependencyError(context, blocked);

  const responseBody = { deletedIds: ids };
  const statements: D1PreparedStatement[] = [];
  for (const category of activeCategories) {
    const deleted = {
      ...category,
      isEnabled: false,
      deletedAt: now,
      updatedAt: now,
    };
    statements.push(
      createDeleteCategoryStatement(context.env.DB, sectionId, category.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'category.deleted',
        entityType: 'category',
        entityId: category.id,
        requestId: context.get('requestId'),
        before: { ...category },
        after: deleted,
        metadata: { sectionId, batch: true },
        createdAt: now,
      }),
    );
  }
  statements.push(
    createIdempotencyStatement(
      context.env.DB,
      `categories.batch-delete.${sectionId}`,
      idempotencyKey,
      responseBody,
      now,
    ),
  );

  await context.env.DB.batch(statements);
  return context.json(responseBody);
});

adminCategoryBatchRoutes.post('/:sectionId/categories/reorder', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const sectionId = context.req.param('sectionId');
  const sectionError = await requireActiveSection(context, sectionId);
  if (sectionError) return sectionError;

  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '排序请求缺少幂等键。');
  }

  const now = new Date().toISOString();
  const prior = await readIdempotentResponse(
    context.env.DB,
    `categories.reorder.${sectionId}`,
    idempotencyKey,
    now,
  );
  if (isRecord(prior)) return context.json(prior);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }

  const items = parseReorderItems(body);
  if (!items) {
    return apiError(context, 400, 'INVALID_CATEGORY_ORDER', '分类排序数据无效。');
  }

  const categories = await Promise.all(
    items.map((item) => getCategory(context.env.DB, sectionId, item.id)),
  );
  if (categories.some((category) => !category || category.deletedAt)) {
    return apiError(context, 404, 'CATEGORY_NOT_FOUND', '部分分类不存在或已进入回收站。');
  }

  const responseBody = { reordered: true };
  const statements = items.map((item) =>
    createReorderCategoryStatement(
      context.env.DB,
      sectionId,
      item.id,
      item.sortOrder,
      now,
    ),
  );
  statements.push(
    createAuditLogStatement(context.env.DB, {
      action: 'category.reordered',
      entityType: 'category',
      requestId: context.get('requestId'),
      metadata: { sectionId, items },
      createdAt: now,
    }),
    createIdempotencyStatement(
      context.env.DB,
      `categories.reorder.${sectionId}`,
      idempotencyKey,
      responseBody,
      now,
    ),
  );

  await context.env.DB.batch(statements);
  return context.json(responseBody);
});
