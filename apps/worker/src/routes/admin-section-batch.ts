import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createIdempotencyStatement,
  normalizeIdempotencyKey,
  readIdempotentResponse,
} from '../idempotency/idempotency';
import {
  createDeleteSectionStatement,
  createReorderSectionStatement,
  getSection,
  hasSectionDependencies,
  type SectionRecord,
} from '../sections/sections';
import type { AppEnvironment } from '../types';
import {
  dependencyError,
  hasAdminRequestHeader,
  isRecord,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const MAX_BATCH_SIZE = 100;

function parseBatchIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) {
    return null;
  }

  const ids = value.ids.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (
    ids.length !== value.ids.length ||
    ids.length === 0 ||
    ids.length > MAX_BATCH_SIZE
  ) {
    return null;
  }

  const uniqueIds = [...new Set(ids)];
  return uniqueIds.length === ids.length ? uniqueIds : null;
}

function parseReorderItems(
  value: unknown,
): Array<{ id: string; sortOrder: number }> | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }
  if (value.items.length === 0 || value.items.length > MAX_BATCH_SIZE) {
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
    ) {
      return null;
    }
    items.push({ id: item.id, sortOrder: item.sortOrder });
  }

  return new Set(items.map((item) => item.id)).size === items.length ? items : null;
}

export const adminSectionBatchRoutes = new Hono<AppEnvironment>();

adminSectionBatchRoutes.post('/batch-delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除缺少幂等键。');
  }

  const now = new Date().toISOString();
  const prior = await readIdempotentResponse(
    context.env.DB,
    'sections.batch-delete',
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

  const ids = parseBatchIds(body);
  if (!ids) {
    return apiError(context, 400, 'INVALID_SECTION_IDS', '请选择有效的分区。');
  }

  const sections = await Promise.all(ids.map((id) => getSection(context.env.DB, id)));
  const activeSections = sections.filter((section): section is SectionRecord =>
    Boolean(section),
  );
  if (
    activeSections.length !== ids.length ||
    activeSections.some((section) => section.deletedAt)
  ) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '部分分区不存在或已进入回收站。');
  }

  const blocked = activeSections.find(hasSectionDependencies);
  if (blocked) {
    return dependencyError(context, blocked);
  }

  const responseBody = { deletedIds: ids };
  const statements: D1PreparedStatement[] = [];
  for (const section of activeSections) {
    const deleted = { ...section, isEnabled: false, deletedAt: now, updatedAt: now };
    statements.push(
      createDeleteSectionStatement(context.env.DB, section.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'section.deleted',
        entityType: 'section',
        entityId: section.id,
        requestId: context.get('requestId'),
        before: { ...section },
        after: deleted,
        metadata: { batch: true },
        createdAt: now,
      }),
    );
  }
  statements.push(
    createIdempotencyStatement(
      context.env.DB,
      'sections.batch-delete',
      idempotencyKey,
      responseBody,
      now,
    ),
  );

  await context.env.DB.batch(statements);
  return context.json(responseBody);
});

adminSectionBatchRoutes.post('/reorder', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '排序请求缺少幂等键。');
  }

  const now = new Date().toISOString();
  const prior = await readIdempotentResponse(
    context.env.DB,
    'sections.reorder',
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

  const items = parseReorderItems(body);
  if (!items) {
    return apiError(context, 400, 'INVALID_SECTION_ORDER', '分区排序数据无效。');
  }

  const sections = await Promise.all(
    items.map((item) => getSection(context.env.DB, item.id)),
  );
  if (sections.some((section) => !section || section.deletedAt)) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '部分分区不存在或已进入回收站。');
  }

  const responseBody = { reordered: true };
  const statements = items.map((item) =>
    createReorderSectionStatement(context.env.DB, item.id, item.sortOrder, now),
  );
  statements.push(
    createAuditLogStatement(context.env.DB, {
      action: 'section.reordered',
      entityType: 'section',
      requestId: context.get('requestId'),
      metadata: { items },
      createdAt: now,
    }),
    createIdempotencyStatement(
      context.env.DB,
      'sections.reorder',
      idempotencyKey,
      responseBody,
      now,
    ),
  );

  await context.env.DB.batch(statements);
  return context.json(responseBody);
});
