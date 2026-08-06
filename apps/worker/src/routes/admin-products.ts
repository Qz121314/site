import { Hono } from 'hono';
import { createAuditLogStatement, writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createDeleteProductStatement,
  createProduct,
  createRestoreProductStatement,
  createUpdateProductStatements,
  getProduct,
  hydrateProduct,
  isProductConflictError,
  listProducts,
  validateProductDependencies,
  validateProductInput,
  type ProductRecord,
  type ProductScope,
} from '../products/products';
import { uploadProductImage } from '../products/product-image-upload';
import { getSection } from '../sections/sections';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

function parseScope(value: string | undefined): ProductScope | null {
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

function productNotFound(context: Parameters<typeof apiError>[0]) {
  return apiError(context, 404, 'PRODUCT_NOT_FOUND', '产品不存在或已进入回收站。');
}

function dependencyError(
  context: Parameters<typeof apiError>[0],
  validation: Exclude<Awaited<ReturnType<typeof validateProductDependencies>>, { ok: true }>,
) {
  return apiError(context, 409, validation.code, validation.message, { field: validation.field });
}

export const adminProductRoutes = new Hono<AppEnvironment>();

adminProductRoutes.get('/:sectionId/products', async (context) => {
  context.header('Cache-Control', 'no-store');
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const scope = parseScope(context.req.query('scope'));
  if (!scope) {
    return apiError(context, 400, 'INVALID_PRODUCT_SCOPE', '产品列表范围无效。');
  }
  return context.json({ products: await listProducts(context.env.DB, sectionId, scope) });
});

adminProductRoutes.get('/:sectionId/products/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  const product = await getProduct(
    context.env.DB,
    context.req.param('sectionId'),
    context.req.param('id'),
  );
  if (!product) return apiError(context, 404, 'PRODUCT_NOT_FOUND', '产品不存在。');
  return context.json({ product });
});

adminProductRoutes.post('/:sectionId/products/media', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;

  let formData: FormData;
  try {
    formData = await context.req.raw.formData();
  } catch {
    return apiError(context, 400, 'INVALID_MULTIPART_FORM', '图片上传表单无效。');
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return apiError(context, 400, 'IMAGE_REQUIRED', '请选择需要上传的产品图片。', {
      field: 'file',
    });
  }

  const result = await uploadProductImage(
    context.env.ASSETS_BUCKET,
    context.env.DB,
    sectionId,
    file,
  );
  if (!result.ok) {
    return apiError(context, 400, result.code, result.message, { field: result.field });
  }

  await writeAuditLog(context.env.DB, {
    action: result.reused ? 'product_media.reused' : 'product_media.uploaded',
    entityType: 'media_asset',
    entityId: result.media.id,
    requestId: context.get('requestId'),
    metadata: {
      sectionId,
      objectKey: result.media.objectKey,
      byteSize: result.media.byteSize,
      width: result.media.width ?? 0,
      height: result.media.height ?? 0,
      reused: result.reused,
    },
  });

  return context.json({ media: result.media, reused: result.reused }, result.reused ? 200 : 201);
});

adminProductRoutes.post('/:sectionId/products', async (context) => {
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
  const validation = validateProductInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_PRODUCT', validation.message, {
      field: validation.field,
    });
  }
  const dependencies = await validateProductDependencies(context.env.DB, sectionId, validation.value);
  if (!dependencies.ok) return dependencyError(context, dependencies);

  const now = new Date().toISOString();
  const created = createProduct(context.env.DB, sectionId, validation.value, now);
  try {
    await context.env.DB.batch([
      ...created.statements,
      createAuditLogStatement(context.env.DB, {
        action: 'product.created',
        entityType: 'product',
        entityId: created.product.id,
        requestId: context.get('requestId'),
        after: {
          ...created.product,
          mediaAssetIds: validation.value.mediaAssetIds,
        },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isProductConflictError(error)) {
      return apiError(context, 409, 'PRODUCT_SLUG_CONFLICT', '产品地址冲突，请重新提交。');
    }
    throw error;
  }

  return context.json({ product: await hydrateProduct(context.env.DB, created.product) }, 201);
});

adminProductRoutes.put('/:sectionId/products/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const current = await getProduct(context.env.DB, sectionId, context.req.param('id'));
  if (!current || current.deletedAt) return productNotFound(context);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const validation = validateProductInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_PRODUCT', validation.message, {
      field: validation.field,
    });
  }
  const dependencies = await validateProductDependencies(context.env.DB, sectionId, validation.value);
  if (!dependencies.ok) return dependencyError(context, dependencies);

  const now = new Date().toISOString();
  const updated: ProductRecord = {
    ...current,
    ...validation.value,
    effectiveCoverAssetId:
      validation.value.coverAssetId ?? validation.value.mediaAssetIds[0] ?? null,
    updatedAt: now,
    publishedAt:
      validation.value.status === 'published' ? current.publishedAt ?? now : current.publishedAt,
  };
  await context.env.DB.batch([
    ...createUpdateProductStatements(context.env.DB, current, validation.value, now),
    createAuditLogStatement(context.env.DB, {
      action: 'product.updated',
      entityType: 'product',
      entityId: current.id,
      requestId: context.get('requestId'),
      before: { ...current },
      after: { ...updated, mediaAssetIds: validation.value.mediaAssetIds },
      metadata: { sectionId },
      createdAt: now,
    }),
  ]);

  return context.json({ product: await getProduct(context.env.DB, sectionId, current.id) });
});

adminProductRoutes.delete('/:sectionId/products/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const current = await getProduct(context.env.DB, sectionId, context.req.param('id'));
  if (!current || current.deletedAt) return productNotFound(context);
  const now = new Date().toISOString();
  const deleted: ProductRecord = { ...current, deletedAt: now, updatedAt: now };
  await context.env.DB.batch([
    createDeleteProductStatement(context.env.DB, sectionId, current.id, now),
    createAuditLogStatement(context.env.DB, {
      action: 'product.deleted',
      entityType: 'product',
      entityId: current.id,
      requestId: context.get('requestId'),
      before: { ...current },
      after: { ...deleted },
      metadata: { sectionId },
      createdAt: now,
    }),
  ]);
  return context.json({ product: deleted });
});

adminProductRoutes.post('/:sectionId/products/:id/restore', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  const sectionId = context.req.param('sectionId');
  const sectionError = await requireSection(context, sectionId);
  if (sectionError) return sectionError;
  const current = await getProduct(context.env.DB, sectionId, context.req.param('id'));
  if (!current || !current.deletedAt) {
    return apiError(context, 404, 'PRODUCT_NOT_FOUND', '回收站中不存在该产品。');
  }
  const now = new Date().toISOString();
  try {
    await context.env.DB.batch([
      createRestoreProductStatement(context.env.DB, sectionId, current.id, now),
      createAuditLogStatement(context.env.DB, {
        action: 'product.restored',
        entityType: 'product',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: {
          ...current,
          deletedAt: null,
          status: 'draft',
          publishedAt: null,
          updatedAt: now,
        },
        metadata: { sectionId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isProductConflictError(error)) {
      return apiError(
        context,
        409,
        'PRODUCT_RESTORE_CONFLICT',
        '当前分区已有相同地址的产品，无法恢复。',
      );
    }
    throw error;
  }
  return context.json({ product: await getProduct(context.env.DB, sectionId, current.id) });
});
