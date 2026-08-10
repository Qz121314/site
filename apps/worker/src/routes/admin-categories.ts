import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  createCategory,
  createDeleteCategoryStatement,
  createRestoreCategoryStatement,
  createUpdateCategoryStatement,
  getCategory,
  hasCategoryDependencies,
  isCategoryConflictError,
  listCategories,
  validateCategoryInput,
  type CategoryRecord,
  type CategoryScope,
} from '../categories/categories';
import { apiError } from '../http/api-response';
import { getSection } from '../sections/sections';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

function parseScope(value: string | undefined): CategoryScope | null {
  if (!value || value === 'active') return 'active';
  if (value === 'trash' || value === 'all') return value;
  return null;
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

function categoryNotFound(context: Parameters<typeof apiError>[0]) {
  return apiError(context, 404, 'CATEGORY_NOT_FOUND', '分类不存在或已进入回收站。');
}

function categoryDependencyError(
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

export const adminCategoryRoutes = new Hono<AppEnvironment>();

adminCategoryRoutes.get('/:sectionId/categories', async (context) => {
  context.header('Cache-Control', 'no-store');
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;

  const scope = parseScope(context.req.query('scope'));
  if (!scope) {
    return apiError(context, 400, 'INVALID_CATEGORY_SCOPE', '分类列表范围无效。');
  }

  return context.json({
    categories: await listCategories(context.env.DB, sectionId, scope),
  });
});

adminCategoryRoutes.get('/:sectionId/categories/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  const category = await getCategory(
    context.env.DB,
    context.req.param('sectionId'),
    context.req.param('id'),
  );
  if (!category) {
    return apiError(context, 404, 'CATEGORY_NOT_FOUND', '分类不存在。');
  }
  return context.json({ category });
});

adminCategoryRoutes.post('/:sectionId/categories', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }

  const validation = validateCategoryInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_CATEGORY', validation.message, {
      field: validation.field,
    });
  }

  const now = new Date().toISOString();
  const created = createCategory(context.env.DB, sectionId, validation.value, now);
  try {
    await context.env.DB.batch([
      created.statement,
      createAuditLogStatement(context.env.DB, {
        action: 'category.created',
        entityType: 'category',
        entityId: created.category.id,
        requestId: context.get('requestId'),
        after: { ...created.category },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isCategoryConflictError(error)) {
      return apiError(
        context,
        409,
        'CATEGORY_NAME_CONFLICT',
        '当前分区已存在相同名称的分类。',
      );
    }
    throw error;
  }

  return context.json({ category: created.category }, 201);
});

adminCategoryRoutes.put('/:sectionId/categories/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const sectionId = context.req.param('sectionId');
  const current = await getCategory(context.env.DB, sectionId, context.req.param('id'));
  if (!current || current.deletedAt) return categoryNotFound(context);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }

  const validation = validateCategoryInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_CATEGORY', validation.message, {
      field: validation.field,
    });
  }

  const now = new Date().toISOString();
  const updated: CategoryRecord = {
    ...current,
    ...validation.value,
    updatedAt: now,
  };

  try {
    await context.env.DB.batch([
      createUpdateCategoryStatement(
        context.env.DB,
        sectionId,
        current.id,
        validation.value,
        now,
      ),
      createAuditLogStatement(context.env.DB, {
        action: 'category.updated',
        entityType: 'category',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: { ...updated },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isCategoryConflictError(error)) {
      return apiError(
        context,
        409,
        'CATEGORY_NAME_CONFLICT',
        '当前分区已存在相同名称的分类。',
      );
    }
    throw error;
  }

  return context.json({ category: updated });
});

adminCategoryRoutes.delete('/:sectionId/categories/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const sectionId = context.req.param('sectionId');
  const current = await getCategory(context.env.DB, sectionId, context.req.param('id'));
  if (!current || current.deletedAt) return categoryNotFound(context);
  if (hasCategoryDependencies(current)) return categoryDependencyError(context, current);

  const now = new Date().toISOString();
  const deleted: CategoryRecord = {
    ...current,
    isEnabled: false,
    deletedAt: now,
    updatedAt: now,
  };
  await context.env.DB.batch([
    createDeleteCategoryStatement(context.env.DB, sectionId, current.id, now),
    createAuditLogStatement(context.env.DB, {
      action: 'category.deleted',
      entityType: 'category',
      entityId: current.id,
      requestId: context.get('requestId'),
      before: { ...current },
      after: { ...deleted },
      metadata: { sectionId },
      createdAt: now,
    }),
  ]);

  return context.json({ category: deleted });
});

adminCategoryRoutes.post('/:sectionId/categories/:id/restore', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;

  const current = await getCategory(context.env.DB, sectionId, context.req.param('id'));
  if (!current || !current.deletedAt) {
    return apiError(context, 404, 'CATEGORY_NOT_FOUND', '回收站中不存在该分类。');
  }

  const now = new Date().toISOString();
  const restored: CategoryRecord = { ...current, deletedAt: null, updatedAt: now };
  try {
    await context.env.DB.batch([
      createRestoreCategoryStatement(context.env.DB, sectionId, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'category.restored',
        entityType: 'category',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: { ...restored },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isCategoryConflictError(error)) {
      return apiError(
        context,
        409,
        'CATEGORY_RESTORE_CONFLICT',
        '当前分区已有相同名称的分类，无法恢复。',
      );
    }
    throw error;
  }

  return context.json({ category: restored });
});
