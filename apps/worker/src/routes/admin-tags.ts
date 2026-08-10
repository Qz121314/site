import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createIdempotencyStatement,
  normalizeIdempotencyKey,
  readIdempotentResponse,
} from '../idempotency/idempotency';
import { getSection } from '../sections/sections';
import {
  createDeleteProductTagStatement,
  createProductTag,
  createReorderProductTagStatement,
  createRestoreProductTagStatement,
  createUpdateProductTagStatement,
  getProductTag,
  hasProductTagDependencies,
  isProductTagConflictError,
  listProductTags,
  validateProductTagInput,
  type ProductTagRecord,
  type ProductTagScope,
} from '../tags/tags';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  isRecord,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const MAX_BATCH_SIZE = 100;

function parseScope(value: string | undefined): ProductTagScope | null {
  if (!value || value === 'active') return 'active';
  if (value === 'trash' || value === 'all') return value;
  return null;
}

function parseBatchIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null;
  const ids = value.ids.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (ids.length === 0 || ids.length !== value.ids.length || ids.length > MAX_BATCH_SIZE)
    return null;
  return new Set(ids).size === ids.length ? ids : null;
}

function parseReorderItems(
  value: unknown,
): Array<{ id: string; sortOrder: number }> | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    value.items.length > MAX_BATCH_SIZE
  ) {
    return null;
  }
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
    )
      return null;
    items.push({ id: item.id, sortOrder: item.sortOrder });
  }
  return new Set(items.map((item) => item.id)).size === items.length ? items : null;
}

async function requireSection(
  context: Parameters<typeof apiError>[0],
  sectionId: string,
) {
  const section = await getSection(context.env.DB, sectionId);
  if (!section || section.deletedAt) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '分区不存在或已进入回收站。');
  }
  return null;
}

function tagNotFound(context: Parameters<typeof apiError>[0]) {
  return apiError(context, 404, 'PRODUCT_TAG_NOT_FOUND', '标签不存在或已进入回收站。');
}

function tagDependencyError(
  context: Parameters<typeof apiError>[0],
  tag: ProductTagRecord,
) {
  return apiError(
    context,
    409,
    'PRODUCT_TAG_HAS_PRODUCTS',
    `标签“${tag.name}”仍被产品引用，不能删除。`,
    { productCount: tag.productCount },
  );
}

export const adminTagRoutes = new Hono<AppEnvironment>();

adminTagRoutes.get('/:sectionId/tags', async (context) => {
  context.header('Cache-Control', 'no-store');
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const scope = parseScope(context.req.query('scope'));
  if (!scope)
    return apiError(context, 400, 'INVALID_PRODUCT_TAG_SCOPE', '标签列表范围无效。');
  return context.json({ tags: await listProductTags(context.env.DB, sectionId, scope) });
});

adminTagRoutes.post('/:sectionId/tags/batch-delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey)
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除缺少幂等键。');
  const now = new Date().toISOString();
  const scope = `product-tags.batch-delete.${sectionId}`;
  const prior = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
  if (isRecord(prior)) return context.json(prior);
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const ids = parseBatchIds(body);
  if (!ids)
    return apiError(context, 400, 'INVALID_PRODUCT_TAG_IDS', '请选择有效的标签。');
  const tags = await Promise.all(
    ids.map((id) => getProductTag(context.env.DB, sectionId, id)),
  );
  const active = tags.filter((tag): tag is ProductTagRecord => Boolean(tag));
  if (active.length !== ids.length || active.some((tag) => tag.deletedAt))
    return tagNotFound(context);
  const blocked = active.find(hasProductTagDependencies);
  if (blocked) return tagDependencyError(context, blocked);
  const responseBody = { deletedIds: ids };
  const statements: D1PreparedStatement[] = [];
  for (const tag of active) {
    const deleted = { ...tag, isEnabled: false, deletedAt: now, updatedAt: now };
    statements.push(
      createDeleteProductTagStatement(context.env.DB, sectionId, tag.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'product-tag.deleted',
        entityType: 'product_tag',
        entityId: tag.id,
        requestId: context.get('requestId'),
        before: { ...tag },
        after: deleted,
        metadata: { sectionId, batch: true },
        createdAt: now,
      }),
    );
  }
  statements.push(
    createIdempotencyStatement(context.env.DB, scope, idempotencyKey, responseBody, now),
  );
  await context.env.DB.batch(statements);
  return context.json(responseBody);
});

adminTagRoutes.post('/:sectionId/tags/reorder', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey)
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '排序请求缺少幂等键。');
  const now = new Date().toISOString();
  const scope = `product-tags.reorder.${sectionId}`;
  const prior = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
  if (isRecord(prior)) return context.json(prior);
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const items = parseReorderItems(body);
  if (!items)
    return apiError(context, 400, 'INVALID_PRODUCT_TAG_ORDER', '标签排序数据无效。');
  const tags = await Promise.all(
    items.map((item) => getProductTag(context.env.DB, sectionId, item.id)),
  );
  if (tags.some((tag) => !tag || tag.deletedAt)) return tagNotFound(context);
  const responseBody = { reordered: true };
  const statements = items.map((item) =>
    createReorderProductTagStatement(
      context.env.DB,
      sectionId,
      item.id,
      item.sortOrder,
      now,
    ),
  );
  statements.push(
    createAuditLogStatement(context.env.DB, {
      action: 'product-tag.reordered',
      entityType: 'product_tag',
      requestId: context.get('requestId'),
      metadata: { sectionId, items },
      createdAt: now,
    }),
    createIdempotencyStatement(context.env.DB, scope, idempotencyKey, responseBody, now),
  );
  await context.env.DB.batch(statements);
  return context.json(responseBody);
});

adminTagRoutes.post('/:sectionId/tags', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const validation = validateProductTagInput(body);
  if (!validation.ok)
    return apiError(context, 400, 'INVALID_PRODUCT_TAG', validation.message, {
      field: validation.field,
    });
  const now = new Date().toISOString();
  const created = createProductTag(context.env.DB, sectionId, validation.value, now);
  try {
    await context.env.DB.batch([
      created.statement,
      createAuditLogStatement(context.env.DB, {
        action: 'product-tag.created',
        entityType: 'product_tag',
        entityId: created.tag.id,
        requestId: context.get('requestId'),
        after: { ...created.tag },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isProductTagConflictError(error))
      return apiError(
        context,
        409,
        'PRODUCT_TAG_NAME_CONFLICT',
        '当前分区已存在同名标签。',
      );
    throw error;
  }
  return context.json({ tag: created.tag }, 201);
});

adminTagRoutes.put('/:sectionId/tags/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const sectionId = context.req.param('sectionId');
  const current = await getProductTag(context.env.DB, sectionId, context.req.param('id'));
  if (!current || current.deletedAt) return tagNotFound(context);
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const validation = validateProductTagInput(body);
  if (!validation.ok)
    return apiError(context, 400, 'INVALID_PRODUCT_TAG', validation.message, {
      field: validation.field,
    });
  const now = new Date().toISOString();
  const updated: ProductTagRecord = { ...current, ...validation.value, updatedAt: now };
  try {
    await context.env.DB.batch([
      createUpdateProductTagStatement(
        context.env.DB,
        sectionId,
        current.id,
        validation.value,
        now,
      ),
      createAuditLogStatement(context.env.DB, {
        action: 'product-tag.updated',
        entityType: 'product_tag',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: { ...updated },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isProductTagConflictError(error))
      return apiError(
        context,
        409,
        'PRODUCT_TAG_NAME_CONFLICT',
        '当前分区已存在同名标签。',
      );
    throw error;
  }
  return context.json({ tag: updated });
});

adminTagRoutes.delete('/:sectionId/tags/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const sectionId = context.req.param('sectionId');
  const current = await getProductTag(context.env.DB, sectionId, context.req.param('id'));
  if (!current || current.deletedAt) return tagNotFound(context);
  if (hasProductTagDependencies(current)) return tagDependencyError(context, current);
  const now = new Date().toISOString();
  const deleted = { ...current, isEnabled: false, deletedAt: now, updatedAt: now };
  await context.env.DB.batch([
    createDeleteProductTagStatement(context.env.DB, sectionId, current.id, now),
    createAuditLogStatement(context.env.DB, {
      action: 'product-tag.deleted',
      entityType: 'product_tag',
      entityId: current.id,
      requestId: context.get('requestId'),
      before: { ...current },
      after: deleted,
      metadata: { sectionId },
      createdAt: now,
    }),
  ]);
  return context.json({ tag: deleted });
});

adminTagRoutes.post('/:sectionId/tags/:id/restore', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const current = await getProductTag(context.env.DB, sectionId, context.req.param('id'));
  if (!current || !current.deletedAt)
    return apiError(context, 404, 'PRODUCT_TAG_NOT_FOUND', '回收站中不存在该标签。');
  const now = new Date().toISOString();
  const restored = { ...current, deletedAt: null, updatedAt: now };
  try {
    await context.env.DB.batch([
      createRestoreProductTagStatement(context.env.DB, sectionId, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'product-tag.restored',
        entityType: 'product_tag',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: restored,
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isProductTagConflictError(error))
      return apiError(
        context,
        409,
        'PRODUCT_TAG_RESTORE_CONFLICT',
        '当前分区已有同名标签，无法恢复。',
      );
    throw error;
  }
  return context.json({ tag: restored });
});
