import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createDeleteSectionStatement,
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
import { adminSectionBatchRoutes } from './admin-section-batch';
import {
  dependencyError,
  hasAdminRequestHeader,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

function parseScope(value: string | undefined): SectionScope | null {
  if (!value || value === 'active') {
    return 'active';
  }
  if (value === 'trash' || value === 'all') {
    return value;
  }
  return null;
}

export const adminSectionRoutes = new Hono<AppEnvironment>();

adminSectionRoutes.route('/', adminSectionBatchRoutes);

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
