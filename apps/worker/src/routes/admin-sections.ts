import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createDeleteSectionStatement,
  createReorderSectionStatement,
  createRestoreSectionStatement,
  createSectionStatements,
  createUpdateSectionStatement,
  getSection,
  hasSectionDependencies,
  isSectionConflictError,
  listSections,
  validateSectionInput,
  type SectionRecord,
  type SectionScope,
} from '../sections/sections';
import type { AppEnvironment } from '../types';

const ADMIN_REQUEST_HEADER = 'x-admin-request';
const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const MAX_BATCH_SIZE = 100;

type IdempotencyRow = {
  response_body: string;
};

function hasAdminRequestHeader(context: Parameters<typeof apiError>[0]): boolean {
  return context.req.header(ADMIN_REQUEST_HEADER) === '1';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonBody(context: Parameters<typeof apiError>[0]): Promise<unknown> {
  const contentType = context.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new Error('INVALID_CONTENT_TYPE');
  }

  try {
    return await context.req.json<unknown>();
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function jsonBodyError(context: Parameters<typeof apiError>[0], error: unknown) {
  const invalidContentType = error instanceof Error && error.message === 'INVALID_CONTENT_TYPE';
  return apiError(
    context,
    400,
    invalidContentType ? 'INVALID_CONTENT_TYPE' : 'INVALID_JSON',
    invalidContentType ? '请求必须使用 JSON。' : '请求 JSON 无效。',
  );
}

function parseScope(value: string | undefined): SectionScope | null {
  if (!value || value === 'active') {
    return 'active';
  }
  if (value === 'trash' || value === 'all') {
    return value;
  }
  return null;
}

function parseBatchIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) {
    return null;
  }

  const ids = value.ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length !== value.ids.length || ids.length === 0 || ids.length > MAX_BATCH_SIZE) {
    return null;
  }

  const uniqueIds = [...new Set(ids)];
  return uniqueIds.length === ids.length ? uniqueIds : null;
}

function parseReorderItems(value: unknown): Array<{ id: string; sortOrder: number }> | null {
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

function readIdempotencyKey(context: Parameters<typeof apiError>[0]): string | null {
  const value = context.req.header(IDEMPOTENCY_HEADER);
  if (!value || value.length > 128) {
    return null;
  }
  return value;
}

async function readIdempotentResponse(
  db: D1Database,
  scope: string,
  key: string,
  now: string,
): Promise<unknown | null> {
  const row = await db
    .prepare(
      `SELECT response_body
       FROM idempotency_keys
       WHERE key = ? AND scope = ? AND expires_at > ?`,
    )
    .bind(key, scope, now)
    .first<IdempotencyRow>();

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.response_body) as unknown;
  } catch {
    return null;
  }
}

function createIdempotencyStatement(
  db: D1Database,
  scope: string,
  key: string,
  responseBody: unknown,
  now: string,
): D1PreparedStatement {
  const expiresAt = new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();
  return db
    .prepare(
      `INSERT INTO idempotency_keys (
         key, scope, response_status, response_body, expires_at, created_at
       ) VALUES (?, ?, 200, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         scope = excluded.scope,
         response_status = excluded.response_status,
         response_body = excluded.response_body,
         expires_at = excluded.expires_at,
         created_at = excluded.created_at`,
    )
    .bind(key, scope, JSON.stringify(responseBody), expiresAt, now);
}

function dependencyError(context: Parameters<typeof apiError>[0], section: SectionRecord) {
  return apiError(
    context,
    409,
    'SECTION_HAS_DEPENDENCIES',
    `分区“${section.name}”仍有关联产品或转化方式，不能删除。`,
    {
      productCount: section.productCount,
      conversionMethodCount: section.conversionMethodCount,
    },
  );
}

export const adminSectionRoutes = new Hono<AppEnvironment>();

adminSectionRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  const scope = parseScope(context.req.query('scope'));
  if (!scope) {
    return apiError(context, 400, 'INVALID_SECTION_SCOPE', '分区列表范围无效。');
  }

  const sections = await listSections(context.env.DB, scope);
  return context.json({ sections });
});

adminSectionRoutes.get('/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  const section = await getSection(context.env.DB, context.req.param('id'));
  if (!section) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '分区不存在。');
  }

  return context.json({ section });
});

adminSectionRoutes.post('/', async (context) => {
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

  const validation = validateSectionInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_SECTION', validation.message, {
      field: validation.field,
    });
  }

  const now = new Date().toISOString();
  const created = await createSectionStatements(context.env.DB, validation.value, now);

  try {
    await context.env.DB.batch([
      ...created.statements,
      createAuditLogStatement(context.env.DB, {
        action: 'section.created',
        entityType: 'section',
        entityId: created.section.id,
        requestId: context.get('requestId'),
        after: { ...created.section },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isSectionConflictError(error)) {
      return apiError(context, 409, 'SECTION_NAME_CONFLICT', '已存在相同名称的分区。');
    }
    throw error;
  }

  return context.json({ section: created.section }, 201);
});

adminSectionRoutes.put('/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const current = await getSection(context.env.DB, context.req.param('id'));
  if (!current || current.deletedAt) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '分区不存在或已进入回收站。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }

  const validation = validateSectionInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_SECTION', validation.message, {
      field: validation.field,
    });
  }

  const now = new Date().toISOString();
  const updated: SectionRecord = {
    ...current,
    name: validation.value.name,
    iconType: 'icon',
    iconValue: validation.value.iconValue,
    iconAssetId: null,
    sortOrder: validation.value.sortOrder,
    isEnabled: validation.value.isEnabled,
    updatedAt: now,
  };

  try {
    await context.env.DB.batch([
      createUpdateSectionStatement(context.env.DB, current.id, validation.value, now),
      createAuditLogStatement(context.env.DB, {
        action: 'section.updated',
        entityType: 'section',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: { ...updated },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isSectionConflictError(error)) {
      return apiError(context, 409, 'SECTION_NAME_CONFLICT', '已存在相同名称的分区。');
    }
    throw error;
  }

  return context.json({ section: updated });
});

adminSectionRoutes.delete('/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const current = await getSection(context.env.DB, context.req.param('id'));
  if (!current || current.deletedAt) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '分区不存在或已进入回收站。');
  }
  if (hasSectionDependencies(current)) {
    return dependencyError(context, current);
  }

  const now = new Date().toISOString();
  const deleted = { ...current, isEnabled: false, deletedAt: now, updatedAt: now };
  await context.env.DB.batch([
    createDeleteSectionStatement(context.env.DB, current.id, now),
    createAuditLogStatement(context.env.DB, {
      action: 'section.deleted',
      entityType: 'section',
      entityId: current.id,
      requestId: context.get('requestId'),
      before: { ...current },
      after: deleted,
      createdAt: now,
    }),
  ]);

  return context.json({ section: deleted });
});

adminSectionRoutes.post('/:id/restore', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const current = await getSection(context.env.DB, context.req.param('id'));
  if (!current || !current.deletedAt) {
    return apiError(context, 404, 'SECTION_NOT_FOUND', '回收站中不存在该分区。');
  }

  const now = new Date().toISOString();
  const restored = { ...current, deletedAt: null, updatedAt: now };
  try {
    await context.env.DB.batch([
      createRestoreSectionStatement(context.env.DB, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'section.restored',
        entityType: 'section',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: restored,
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isSectionConflictError(error)) {
      return apiError(
        context,
        409,
        'SECTION_RESTORE_CONFLICT',
        '当前已有相同名称或地址标识的分区，无法恢复。',
      );
    }
    throw error;
  }

  return context.json({ section: restored });
});

adminSectionRoutes.post('/batch-delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const idempotencyKey = readIdempotencyKey(context);
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
  if (prior) {
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
  const activeSections = sections.filter((section): section is SectionRecord => Boolean(section));
  if (activeSections.length !== ids.length || activeSections.some((section) => section.deletedAt)) {
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

adminSectionRoutes.post('/reorder', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const idempotencyKey = readIdempotencyKey(context);
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
  if (prior) {
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

  const sections = await Promise.all(items.map((item) => getSection(context.env.DB, item.id)));
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
