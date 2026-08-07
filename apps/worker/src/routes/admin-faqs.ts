import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  createDeleteFaqStatement,
  createFaq,
  createReorderFaqStatement,
  createRestoreFaqStatement,
  createUpdateFaqStatement,
  getFaq,
  isFaqConflictError,
  listFaqs,
  validateFaqInput,
  type FaqRecord,
  type FaqScope,
} from '../faqs/faqs';
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

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const MAX_BATCH_SIZE = 100;

function parseScope(value: string | undefined): FaqScope | null {
  if (!value || value === 'active') return 'active';
  if (value === 'trash' || value === 'all') return value;
  return null;
}

function parseBatchIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null;
  const ids = value.ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0 || ids.length !== value.ids.length || ids.length > MAX_BATCH_SIZE) return null;
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
    ) return null;
    items.push({ id: item.id, sortOrder: item.sortOrder });
  }
  return new Set(items.map((item) => item.id)).size === items.length ? items : null;
}

function faqNotFound(context: Parameters<typeof apiError>[0]) {
  return apiError(context, 404, 'FAQ_NOT_FOUND', 'FAQ 不存在或已进入回收站。');
}

export const adminFaqRoutes = new Hono<AppEnvironment>();

adminFaqRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  const scope = parseScope(context.req.query('scope'));
  if (!scope) return apiError(context, 400, 'INVALID_FAQ_SCOPE', 'FAQ 列表范围无效。');
  return context.json({ faqs: await listFaqs(context.env.DB, scope) });
});

adminFaqRoutes.post('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const validation = validateFaqInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_FAQ', validation.message, { field: validation.field });
  }
  const now = new Date().toISOString();
  const created = createFaq(context.env.DB, validation.value, now);
  try {
    await context.env.DB.batch([
      created.statement,
      createAuditLogStatement(context.env.DB, {
        action: 'faq.created',
        entityType: 'faq',
        entityId: created.faq.id,
        requestId: context.get('requestId'),
        after: { ...created.faq },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isFaqConflictError(error)) {
      return apiError(context, 409, 'FAQ_TITLE_CONFLICT', '已存在相同标题的 FAQ。');
    }
    throw error;
  }
  return context.json({ faq: created.faq }, 201);
});

adminFaqRoutes.put('/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const current = await getFaq(context.env.DB, context.req.param('id'));
  if (!current || current.deletedAt) return faqNotFound(context);
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const validation = validateFaqInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_FAQ', validation.message, { field: validation.field });
  }
  const now = new Date().toISOString();
  const updated: FaqRecord = { ...current, ...validation.value, updatedAt: now };
  try {
    await context.env.DB.batch([
      createUpdateFaqStatement(context.env.DB, current.id, validation.value, now),
      createAuditLogStatement(context.env.DB, {
        action: 'faq.updated', entityType: 'faq', entityId: current.id,
        requestId: context.get('requestId'), before: { ...current }, after: { ...updated }, createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isFaqConflictError(error)) {
      return apiError(context, 409, 'FAQ_TITLE_CONFLICT', '已存在相同标题的 FAQ。');
    }
    throw error;
  }
  return context.json({ faq: updated });
});

adminFaqRoutes.delete('/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const current = await getFaq(context.env.DB, context.req.param('id'));
  if (!current || current.deletedAt) return faqNotFound(context);
  const now = new Date().toISOString();
  const deleted: FaqRecord = { ...current, isEnabled: false, deletedAt: now, updatedAt: now };
  await context.env.DB.batch([
    createDeleteFaqStatement(context.env.DB, current.id, now),
    createAuditLogStatement(context.env.DB, {
      action: 'faq.deleted', entityType: 'faq', entityId: current.id,
      requestId: context.get('requestId'), before: { ...current }, after: { ...deleted }, createdAt: now,
    }),
  ]);
  return context.json({ faq: deleted });
});

adminFaqRoutes.post('/:id/restore', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const current = await getFaq(context.env.DB, context.req.param('id'));
  if (!current || !current.deletedAt) {
    return apiError(context, 404, 'FAQ_NOT_FOUND', '回收站中不存在该 FAQ。');
  }
  const now = new Date().toISOString();
  const restored: FaqRecord = { ...current, deletedAt: null, updatedAt: now };
  try {
    await context.env.DB.batch([
      createRestoreFaqStatement(context.env.DB, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'faq.restored', entityType: 'faq', entityId: current.id,
        requestId: context.get('requestId'), before: { ...current }, after: { ...restored }, createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isFaqConflictError(error)) {
      return apiError(context, 409, 'FAQ_RESTORE_CONFLICT', '当前已有相同标题的 FAQ，无法恢复。');
    }
    throw error;
  }
  return context.json({ faq: restored });
});

adminFaqRoutes.post('/batch-delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除缺少幂等键。');
  }
  const now = new Date().toISOString();
  const prior = await readIdempotentResponse(context.env.DB, 'faqs.batch-delete', idempotencyKey, now);
  if (isRecord(prior)) return context.json(prior);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const ids = parseBatchIds(body);
  if (!ids) return apiError(context, 400, 'INVALID_FAQ_IDS', '请选择有效的 FAQ。');
  const faqs = await Promise.all(ids.map((id) => getFaq(context.env.DB, id)));
  const activeFaqs = faqs.filter((faq): faq is FaqRecord => Boolean(faq));
  if (activeFaqs.length !== ids.length || activeFaqs.some((faq) => faq.deletedAt)) {
    return apiError(context, 404, 'FAQ_NOT_FOUND', '部分 FAQ 不存在或已进入回收站。');
  }
  const statements: D1PreparedStatement[] = [];
  for (const faq of activeFaqs) {
    const deleted = { ...faq, isEnabled: false, deletedAt: now, updatedAt: now };
    statements.push(
      createDeleteFaqStatement(context.env.DB, faq.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'faq.deleted', entityType: 'faq', entityId: faq.id,
        requestId: context.get('requestId'), before: { ...faq }, after: deleted,
        metadata: { batch: true }, createdAt: now,
      }),
    );
  }
  const responseBody = { deletedIds: ids };
  statements.push(
    createIdempotencyStatement(context.env.DB, 'faqs.batch-delete', idempotencyKey, responseBody, now),
  );
  await context.env.DB.batch(statements);
  return context.json(responseBody);
});

adminFaqRoutes.post('/reorder', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '排序请求缺少幂等键。');
  }
  const now = new Date().toISOString();
  const prior = await readIdempotentResponse(context.env.DB, 'faqs.reorder', idempotencyKey, now);
  if (isRecord(prior)) return context.json(prior);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const items = parseReorderItems(body);
  if (!items) return apiError(context, 400, 'INVALID_FAQ_ORDER', 'FAQ 排序数据无效。');
  const faqs = await Promise.all(items.map((item) => getFaq(context.env.DB, item.id)));
  if (faqs.some((faq) => !faq || faq.deletedAt)) {
    return apiError(context, 404, 'FAQ_NOT_FOUND', '部分 FAQ 不存在或已进入回收站。');
  }
  const responseBody = { reordered: true };
  const statements = items.map((item) =>
    createReorderFaqStatement(context.env.DB, item.id, item.sortOrder, now),
  );
  statements.push(
    createAuditLogStatement(context.env.DB, {
      action: 'faq.reordered', entityType: 'faq', requestId: context.get('requestId'),
      metadata: { items }, createdAt: now,
    }),
    createIdempotencyStatement(context.env.DB, 'faqs.reorder', idempotencyKey, responseBody, now),
  );
  await context.env.DB.batch(statements);
  return context.json(responseBody);
});
