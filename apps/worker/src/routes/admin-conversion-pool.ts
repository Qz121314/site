import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  createConversionGroup,
  createConversionTarget,
  createDeleteConversionGroupStatement,
  createDeleteConversionTargetStatement,
  createReorderConversionGroupStatement,
  createReorderConversionTargetStatement,
  createRestoreConversionGroupStatement,
  createRestoreConversionTargetStatement,
  createUpdateConversionGroupStatement,
  createUpdateConversionTargetStatement,
  getConversionGroup,
  getConversionTarget,
  hasGroupDeleteBlocker,
  isConversionGroupConflictError,
  isConversionTargetConflictError,
  listConversionGroups,
  listConversionTargets,
  selectNextConversionTarget,
  validateConversionGroupInput,
  validateConversionTargetInput,
  type ConversionGroupRecord,
  type ConversionScope,
  type ConversionTargetRecord,
} from '../conversion-pool/conversion-pool';
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

function parseScope(value: string | undefined): ConversionScope | null {
  if (!value || value === 'active') return 'active';
  if (value === 'trash' || value === 'all') return value;
  return null;
}

function parseBatchIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null;
  const ids = value.ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0 || ids.length !== value.ids.length || ids.length > MAX_BATCH_SIZE) {
    return null;
  }
  const unique = [...new Set(ids)];
  return unique.length === ids.length ? unique : null;
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

function groupNotFound(context: Parameters<typeof apiError>[0]) {
  return apiError(context, 404, 'CONVERSION_GROUP_NOT_FOUND', '转化分组不存在或已进入回收站。');
}

function targetNotFound(context: Parameters<typeof apiError>[0]) {
  return apiError(context, 404, 'CONVERSION_TARGET_NOT_FOUND', '转化入口不存在或已进入回收站。');
}

function groupDeleteError(
  context: Parameters<typeof apiError>[0],
  group: ConversionGroupRecord,
) {
  return apiError(
    context,
    409,
    'CONVERSION_GROUP_HAS_DEPENDENCIES',
    `转化分组“${group.name}”仍有入口或产品引用，不能删除。`,
    { targetCount: group.targetCount, productCount: group.productCount },
  );
}

async function readBody(context: Parameters<typeof apiError>[0]): Promise<unknown | Response> {
  try {
    return await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
}

async function requireActiveGroup(
  context: Parameters<typeof apiError>[0],
  sectionId: string,
  groupId: string,
): Promise<ConversionGroupRecord | Response> {
  const group = await getConversionGroup(context.env.DB, sectionId, groupId);
  return !group || group.deletedAt ? groupNotFound(context) : group;
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export const adminConversionPoolRoutes = new Hono<AppEnvironment>();

adminConversionPoolRoutes.get('/:sectionId/conversion-groups', async (context) => {
  context.header('Cache-Control', 'no-store');
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const scope = parseScope(context.req.query('scope'));
  if (!scope) {
    return apiError(context, 400, 'INVALID_CONVERSION_SCOPE', '转化分组列表范围无效。');
  }
  return context.json({ groups: await listConversionGroups(context.env.DB, sectionId, scope) });
});

adminConversionPoolRoutes.post('/:sectionId/conversion-groups/batch-delete', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除缺少幂等键。');
  }
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const now = new Date().toISOString();
  const scope = `conversion-groups.batch-delete:${sectionId}`;
  const prior = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
  if (isRecord(prior)) return context.json(prior);
  const body = await readBody(context);
  if (isResponse(body)) return body;
  const ids = parseBatchIds(body);
  if (!ids) {
    return apiError(context, 400, 'INVALID_CONVERSION_GROUP_IDS', '请选择有效的转化分组。');
  }
  const groups = await Promise.all(ids.map((id) => getConversionGroup(context.env.DB, sectionId, id)));
  const active = groups.filter((group): group is ConversionGroupRecord => Boolean(group));
  if (active.length !== ids.length || active.some((group) => group.deletedAt)) return groupNotFound(context);
  const blocked = active.find(hasGroupDeleteBlocker);
  if (blocked) return groupDeleteError(context, blocked);

  const responseBody = { deletedIds: ids };
  const statements: D1PreparedStatement[] = [];
  for (const group of active) {
    const deleted = { ...group, isEnabled: false, deletedAt: now, updatedAt: now };
    statements.push(
      createDeleteConversionGroupStatement(context.env.DB, sectionId, group.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'conversion-group.deleted',
        entityType: 'conversion_group',
        entityId: group.id,
        requestId: context.get('requestId'),
        before: { ...group },
        after: deleted,
        metadata: { sectionId, batch: true },
        createdAt: now,
      }),
    );
  }
  statements.push(createIdempotencyStatement(context.env.DB, scope, idempotencyKey, responseBody, now));
  await context.env.DB.batch(statements);
  return context.json(responseBody);
});

adminConversionPoolRoutes.post('/:sectionId/conversion-groups/reorder', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
  if (!idempotencyKey) {
    return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '排序请求缺少幂等键。');
  }
  const sectionId = context.req.param('sectionId');
  const now = new Date().toISOString();
  const scope = `conversion-groups.reorder:${sectionId}`;
  const prior = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
  if (isRecord(prior)) return context.json(prior);
  const body = await readBody(context);
  if (isResponse(body)) return body;
  const items = parseReorderItems(body);
  if (!items) {
    return apiError(context, 400, 'INVALID_CONVERSION_GROUP_ORDER', '转化分组排序数据无效。');
  }
  const groups = await Promise.all(
    items.map((item) => getConversionGroup(context.env.DB, sectionId, item.id)),
  );
  if (groups.some((group) => !group || group.deletedAt)) return groupNotFound(context);
  const responseBody = { reordered: true };
  const statements = items.map((item) =>
    createReorderConversionGroupStatement(context.env.DB, sectionId, item.id, item.sortOrder, now),
  );
  statements.push(
    createAuditLogStatement(context.env.DB, {
      action: 'conversion-group.reordered',
      entityType: 'conversion_group',
      requestId: context.get('requestId'),
      metadata: { sectionId, items },
      createdAt: now,
    }),
    createIdempotencyStatement(context.env.DB, scope, idempotencyKey, responseBody, now),
  );
  await context.env.DB.batch(statements);
  return context.json(responseBody);
});

adminConversionPoolRoutes.post('/:sectionId/conversion-groups', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const body = await readBody(context);
  if (isResponse(body)) return body;
  const validation = validateConversionGroupInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_CONVERSION_GROUP', validation.message, {
      field: validation.field,
    });
  }
  const now = new Date().toISOString();
  const created = createConversionGroup(context.env.DB, sectionId, validation.value, now);
  try {
    await context.env.DB.batch([
      created.statement,
      createAuditLogStatement(context.env.DB, {
        action: 'conversion-group.created',
        entityType: 'conversion_group',
        entityId: created.group.id,
        requestId: context.get('requestId'),
        after: { ...created.group },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isConversionGroupConflictError(error)) {
      return apiError(context, 409, 'CONVERSION_GROUP_NAME_CONFLICT', '当前分区已存在同名转化分组。');
    }
    throw error;
  }
  return context.json({ group: created.group }, 201);
});

adminConversionPoolRoutes.put('/:sectionId/conversion-groups/:groupId', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const current = await getConversionGroup(context.env.DB, sectionId, context.req.param('groupId'));
  if (!current || current.deletedAt) return groupNotFound(context);
  const body = await readBody(context);
  if (isResponse(body)) return body;
  const validation = validateConversionGroupInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_CONVERSION_GROUP', validation.message, {
      field: validation.field,
    });
  }
  if (current.mode !== validation.value.mode && current.targetCount > 0) {
    return apiError(
      context,
      409,
      'CONVERSION_GROUP_MODE_LOCKED',
      '分组已有入口，删除全部入口后才能修改分组类型。',
      { targetCount: current.targetCount },
    );
  }
  const now = new Date().toISOString();
  const updated: ConversionGroupRecord = { ...current, ...validation.value, updatedAt: now };
  try {
    await context.env.DB.batch([
      createUpdateConversionGroupStatement(
        context.env.DB,
        sectionId,
        current.id,
        validation.value,
        now,
      ),
      createAuditLogStatement(context.env.DB, {
        action: 'conversion-group.updated',
        entityType: 'conversion_group',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: { ...updated },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isConversionGroupConflictError(error)) {
      return apiError(context, 409, 'CONVERSION_GROUP_NAME_CONFLICT', '当前分区已存在同名转化分组。');
    }
    throw error;
  }
  return context.json({ group: updated });
});

adminConversionPoolRoutes.delete('/:sectionId/conversion-groups/:groupId', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const current = await getConversionGroup(context.env.DB, sectionId, context.req.param('groupId'));
  if (!current || current.deletedAt) return groupNotFound(context);
  if (hasGroupDeleteBlocker(current)) return groupDeleteError(context, current);
  const now = new Date().toISOString();
  const deleted = { ...current, isEnabled: false, deletedAt: now, updatedAt: now };
  await context.env.DB.batch([
    createDeleteConversionGroupStatement(context.env.DB, sectionId, current.id, now),
    createAuditLogStatement(context.env.DB, {
      action: 'conversion-group.deleted',
      entityType: 'conversion_group',
      entityId: current.id,
      requestId: context.get('requestId'),
      before: { ...current },
      after: deleted,
      metadata: { sectionId },
      createdAt: now,
    }),
  ]);
  return context.json({ group: deleted });
});

adminConversionPoolRoutes.post('/:sectionId/conversion-groups/:groupId/restore', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const current = await getConversionGroup(context.env.DB, sectionId, context.req.param('groupId'));
  if (!current || !current.deletedAt) {
    return apiError(context, 404, 'CONVERSION_GROUP_NOT_FOUND', '回收站中不存在该转化分组。');
  }
  const now = new Date().toISOString();
  const restored = { ...current, deletedAt: null, updatedAt: now };
  try {
    await context.env.DB.batch([
      createRestoreConversionGroupStatement(context.env.DB, sectionId, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'conversion-group.restored',
        entityType: 'conversion_group',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: restored,
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isConversionGroupConflictError(error)) {
      return apiError(context, 409, 'CONVERSION_GROUP_RESTORE_CONFLICT', '当前分区已有同名转化分组。');
    }
    throw error;
  }
  return context.json({ group: restored });
});

adminConversionPoolRoutes.post('/:sectionId/conversion-groups/:groupId/rotate-preview', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const group = await getConversionGroup(context.env.DB, sectionId, context.req.param('groupId'));
  if (!group || group.deletedAt) return groupNotFound(context);
  const target = await selectNextConversionTarget(context.env.DB, group, new Date().toISOString());
  if (!target) {
    return apiError(context, 409, 'CONVERSION_GROUP_NOT_READY', '分组未启用或没有可用入口。');
  }
  return context.json({ target });
});

adminConversionPoolRoutes.get('/:sectionId/conversion-groups/:groupId/targets', async (context) => {
  context.header('Cache-Control', 'no-store');
  const sectionId = context.req.param('sectionId');
  const group = await requireActiveGroup(context, sectionId, context.req.param('groupId'));
  if (isResponse(group)) return group;
  const scope = parseScope(context.req.query('scope'));
  if (!scope) {
    return apiError(context, 400, 'INVALID_CONVERSION_SCOPE', '转化入口列表范围无效。');
  }
  return context.json({
    targets: await listConversionTargets(context.env.DB, sectionId, group.id, scope),
  });
});

adminConversionPoolRoutes.post(
  '/:sectionId/conversion-groups/:groupId/targets/batch-delete',
  async (context) => {
    context.header('Cache-Control', 'no-store');
    if (!hasAdminRequestHeader(context)) {
      return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
    }
    const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
    if (!idempotencyKey) {
      return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '批量删除缺少幂等键。');
    }
    const sectionId = context.req.param('sectionId');
    const groupId = context.req.param('groupId');
    const group = await requireActiveGroup(context, sectionId, groupId);
    if (isResponse(group)) return group;
    const now = new Date().toISOString();
    const scope = `conversion-targets.batch-delete:${groupId}`;
    const prior = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
    if (isRecord(prior)) return context.json(prior);
    const body = await readBody(context);
    if (isResponse(body)) return body;
    const ids = parseBatchIds(body);
    if (!ids) {
      return apiError(context, 400, 'INVALID_CONVERSION_TARGET_IDS', '请选择有效的转化入口。');
    }
    const targets = await Promise.all(
      ids.map((id) => getConversionTarget(context.env.DB, sectionId, groupId, id)),
    );
    const active = targets.filter((target): target is ConversionTargetRecord => Boolean(target));
    if (active.length !== ids.length || active.some((target) => target.deletedAt)) return targetNotFound(context);
    const responseBody = { deletedIds: ids };
    const statements: D1PreparedStatement[] = [];
    for (const target of active) {
      const deleted = { ...target, isEnabled: false, deletedAt: now, updatedAt: now };
      statements.push(
        createDeleteConversionTargetStatement(context.env.DB, sectionId, groupId, target.id, now),
        createAuditLogStatement(context.env.DB, {
          action: 'conversion-target.deleted',
          entityType: 'conversion_target',
          entityId: target.id,
          requestId: context.get('requestId'),
          before: { ...target },
          after: deleted,
          metadata: { sectionId, groupId, batch: true },
          createdAt: now,
        }),
      );
    }
    statements.push(createIdempotencyStatement(context.env.DB, scope, idempotencyKey, responseBody, now));
    await context.env.DB.batch(statements);
    return context.json(responseBody);
  },
);

adminConversionPoolRoutes.post(
  '/:sectionId/conversion-groups/:groupId/targets/reorder',
  async (context) => {
    context.header('Cache-Control', 'no-store');
    if (!hasAdminRequestHeader(context)) {
      return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
    }
    const idempotencyKey = normalizeIdempotencyKey(context.req.header(IDEMPOTENCY_HEADER));
    if (!idempotencyKey) {
      return apiError(context, 400, 'IDEMPOTENCY_KEY_REQUIRED', '排序请求缺少幂等键。');
    }
    const sectionId = context.req.param('sectionId');
    const groupId = context.req.param('groupId');
    const group = await requireActiveGroup(context, sectionId, groupId);
    if (isResponse(group)) return group;
    const now = new Date().toISOString();
    const scope = `conversion-targets.reorder:${groupId}`;
    const prior = await readIdempotentResponse(context.env.DB, scope, idempotencyKey, now);
    if (isRecord(prior)) return context.json(prior);
    const body = await readBody(context);
    if (isResponse(body)) return body;
    const items = parseReorderItems(body);
    if (!items) {
      return apiError(context, 400, 'INVALID_CONVERSION_TARGET_ORDER', '转化入口排序数据无效。');
    }
    const targets = await Promise.all(
      items.map((item) => getConversionTarget(context.env.DB, sectionId, groupId, item.id)),
    );
    if (targets.some((target) => !target || target.deletedAt)) return targetNotFound(context);
    const responseBody = { reordered: true };
    const statements = items.map((item) =>
      createReorderConversionTargetStatement(
        context.env.DB,
        sectionId,
        groupId,
        item.id,
        item.sortOrder,
        now,
      ),
    );
    statements.push(
      createAuditLogStatement(context.env.DB, {
        action: 'conversion-target.reordered',
        entityType: 'conversion_target',
        requestId: context.get('requestId'),
        metadata: { sectionId, groupId, items },
        createdAt: now,
      }),
      createIdempotencyStatement(context.env.DB, scope, idempotencyKey, responseBody, now),
    );
    await context.env.DB.batch(statements);
    return context.json(responseBody);
  },
);

adminConversionPoolRoutes.post('/:sectionId/conversion-groups/:groupId/targets', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const groupId = context.req.param('groupId');
  const group = await requireActiveGroup(context, sectionId, groupId);
  if (isResponse(group)) return group;
  const body = await readBody(context);
  if (isResponse(body)) return body;
  const validation = validateConversionTargetInput(body, group.mode);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_CONVERSION_TARGET', validation.message, {
      field: validation.field,
    });
  }
  const now = new Date().toISOString();
  const created = createConversionTarget(context.env.DB, sectionId, groupId, validation.value, now);
  try {
    await context.env.DB.batch([
      created.statement,
      createAuditLogStatement(context.env.DB, {
        action: 'conversion-target.created',
        entityType: 'conversion_target',
        entityId: created.target.id,
        requestId: context.get('requestId'),
        after: { ...created.target },
        metadata: { sectionId, groupId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isConversionTargetConflictError(error)) {
      return apiError(context, 409, 'CONVERSION_TARGET_NAME_CONFLICT', '当前分组已存在同名入口。');
    }
    throw error;
  }
  return context.json({ target: created.target }, 201);
});

adminConversionPoolRoutes.put(
  '/:sectionId/conversion-groups/:groupId/targets/:targetId',
  async (context) => {
    context.header('Cache-Control', 'no-store');
    if (!hasAdminRequestHeader(context)) {
      return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
    }
    const sectionId = context.req.param('sectionId');
    const groupId = context.req.param('groupId');
    const group = await requireActiveGroup(context, sectionId, groupId);
    if (isResponse(group)) return group;
    const current = await getConversionTarget(
      context.env.DB,
      sectionId,
      groupId,
      context.req.param('targetId'),
    );
    if (!current || current.deletedAt) return targetNotFound(context);
    const body = await readBody(context);
    if (isResponse(body)) return body;
    const validation = validateConversionTargetInput(body, group.mode);
    if (!validation.ok) {
      return apiError(context, 400, 'INVALID_CONVERSION_TARGET', validation.message, {
        field: validation.field,
      });
    }
    const now = new Date().toISOString();
    const updated: ConversionTargetRecord = { ...current, ...validation.value, updatedAt: now };
    try {
      await context.env.DB.batch([
        createUpdateConversionTargetStatement(
          context.env.DB,
          sectionId,
          groupId,
          current.id,
          validation.value,
          now,
        ),
        createAuditLogStatement(context.env.DB, {
          action: 'conversion-target.updated',
          entityType: 'conversion_target',
          entityId: current.id,
          requestId: context.get('requestId'),
          before: { ...current },
          after: { ...updated },
          metadata: { sectionId, groupId },
          createdAt: now,
        }),
      ]);
    } catch (error) {
      if (isConversionTargetConflictError(error)) {
        return apiError(context, 409, 'CONVERSION_TARGET_NAME_CONFLICT', '当前分组已存在同名入口。');
      }
      throw error;
    }
    return context.json({ target: updated });
  },
);

adminConversionPoolRoutes.delete(
  '/:sectionId/conversion-groups/:groupId/targets/:targetId',
  async (context) => {
    context.header('Cache-Control', 'no-store');
    if (!hasAdminRequestHeader(context)) {
      return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
    }
    const sectionId = context.req.param('sectionId');
    const groupId = context.req.param('groupId');
    const current = await getConversionTarget(
      context.env.DB,
      sectionId,
      groupId,
      context.req.param('targetId'),
    );
    if (!current || current.deletedAt) return targetNotFound(context);
    const now = new Date().toISOString();
    const deleted = { ...current, isEnabled: false, deletedAt: now, updatedAt: now };
    await context.env.DB.batch([
      createDeleteConversionTargetStatement(context.env.DB, sectionId, groupId, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'conversion-target.deleted',
        entityType: 'conversion_target',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: deleted,
        metadata: { sectionId, groupId },
        createdAt: now,
      }),
    ]);
    return context.json({ target: deleted });
  },
);

adminConversionPoolRoutes.post(
  '/:sectionId/conversion-groups/:groupId/targets/:targetId/restore',
  async (context) => {
    context.header('Cache-Control', 'no-store');
    if (!hasAdminRequestHeader(context)) {
      return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
    }
    const sectionId = context.req.param('sectionId');
    const groupId = context.req.param('groupId');
    const group = await requireActiveGroup(context, sectionId, groupId);
    if (isResponse(group)) return group;
    const current = await getConversionTarget(
      context.env.DB,
      sectionId,
      groupId,
      context.req.param('targetId'),
    );
    if (!current || !current.deletedAt) {
      return apiError(context, 404, 'CONVERSION_TARGET_NOT_FOUND', '回收站中不存在该转化入口。');
    }
    const now = new Date().toISOString();
    const restored = { ...current, deletedAt: null, updatedAt: now };
    try {
      await context.env.DB.batch([
        createRestoreConversionTargetStatement(context.env.DB, sectionId, groupId, current.id, now),
        createAuditLogStatement(context.env.DB, {
          action: 'conversion-target.restored',
          entityType: 'conversion_target',
          entityId: current.id,
          requestId: context.get('requestId'),
          before: { ...current },
          after: restored,
          metadata: { sectionId, groupId },
          createdAt: now,
        }),
      ]);
    } catch (error) {
      if (isConversionTargetConflictError(error)) {
        return apiError(context, 409, 'CONVERSION_TARGET_RESTORE_CONFLICT', '当前分组已有同名入口。');
      }
      throw error;
    }
    return context.json({ target: restored });
  },
);
