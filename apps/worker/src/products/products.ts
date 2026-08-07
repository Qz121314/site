import { buildAssetPublicUrl, getMediaBaseUrl } from '../assets/asset-library';
import { getCategory } from '../categories/categories';
import { getConversionGroup, type ConversionMode } from '../conversion-pool/conversion-pool';

export type ProductServiceMode = 'online' | 'offline';
export type ProductStatus = 'draft' | 'published' | 'archived';
export type ProductScope = 'active' | 'trash' | 'all';

export type ProductMediaRecord = {
  id: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  altText: string | null;
  publicUrl: string | null;
};

export type ProductRecord = {
  id: string;
  sectionId: string;
  slug: string;
  serviceMode: ProductServiceMode;
  title: string;
  body: string;
  address: string | null;
  categoryId: string | null;
  categoryName: string | null;
  conversionGroupId: string | null;
  conversionGroupName: string | null;
  conversionMode: ConversionMode | null;
  buttonLabel: string | null;
  coverAssetId: string | null;
  effectiveCoverAssetId: string | null;
  effectiveCoverUrl: string | null;
  media: ProductMediaRecord[];
  isFeatured: boolean;
  featuredOrder: number;
  sortOrder: number;
  status: ProductStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ProductInput = {
  serviceMode: ProductServiceMode;
  title: string;
  body: string;
  address: string | null;
  categoryId: string | null;
  conversionGroupId: string | null;
  coverAssetId: string | null;
  mediaAssetIds: string[];
  isFeatured: boolean;
  featuredOrder: number;
  sortOrder: number;
  status: ProductStatus;
};

type ProductRow = {
  id: string;
  section_id: string;
  slug: string;
  service_mode: ProductServiceMode;
  title: string;
  body: string;
  address: string | null;
  category_id: string | null;
  category_name: string | null;
  conversion_group_id: string | null;
  conversion_group_name: string | null;
  conversion_mode: ConversionMode | null;
  button_label: string | null;
  cover_asset_id: string | null;
  effective_cover_asset_id: string | null;
  effective_cover_object_key: string | null;
  is_featured: number;
  featured_order: number;
  sort_order: number;
  status: ProductStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  media_base_url: string | null;
};

type ProductMediaRow = {
  id: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  sort_order: number;
  alt_text: string | null;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; message: string };

export type ProductDependencyValidation =
  | { ok: true }
  | { ok: false; field: string; code: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, field, message: `${label}必须是文本。` };
  }
  const normalized = value.trim();
  if (!normalized) return { ok: false, field, message: `请填写${label}。` };
  if (normalized.length > maxLength) {
    return { ok: false, field, message: `${label}不能超过 ${maxLength} 个字符。` };
  }
  return { ok: true, value: normalized };
}

function readOptionalText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
): ValidationResult<string | null> {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, field, message: `${label}必须是文本。` };
  }
  const normalized = value.trim();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > maxLength) {
    return { ok: false, field, message: `${label}不能超过 ${maxLength} 个字符。` };
  }
  return { ok: true, value: normalized };
}

function readOptionalId(value: unknown, field: string, label: string): ValidationResult<string | null> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  if (typeof value !== 'string' || value.length > 100) {
    return { ok: false, field, message: `${label}无效。` };
  }
  return { ok: true, value };
}

function readOrder(value: unknown, field: string, label: string): ValidationResult<number> {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 1_000_000
  ) {
    return { ok: false, field, message: `${label}必须是 0 到 1000000 的整数。` };
  }
  return { ok: true, value };
}

function readMediaIds(value: unknown): ValidationResult<string[]> {
  if (!Array.isArray(value)) {
    return { ok: false, field: 'mediaAssetIds', message: '产品图片列表无效。' };
  }
  if (value.length > 12) {
    return { ok: false, field: 'mediaAssetIds', message: '每个产品最多上传 12 张图片。' };
  }
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100);
  if (ids.length !== value.length || new Set(ids).size !== ids.length) {
    return { ok: false, field: 'mediaAssetIds', message: '产品图片列表包含无效或重复图片。' };
  }
  return { ok: true, value: ids };
}

export function validateProductInput(value: unknown): ValidationResult<ProductInput> {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '产品数据无效。' };
  }
  if (value.serviceMode !== 'online' && value.serviceMode !== 'offline') {
    return { ok: false, field: 'serviceMode', message: '请选择线上服务或线下服务。' };
  }
  const title = readRequiredText(value.title, 'title', '产品标题', 200);
  if (!title.ok) return title;
  const body = readRequiredText(value.body, 'body', '产品正文', 20_000);
  if (!body.ok) return body;
  const address = readOptionalText(value.address, 'address', '服务地址', 500);
  if (!address.ok) return address;
  const categoryId = readOptionalId(value.categoryId, 'categoryId', '分类');
  if (!categoryId.ok) return categoryId;
  const conversionGroupId = readOptionalId(
    value.conversionGroupId,
    'conversionGroupId',
    '转化分组',
  );
  if (!conversionGroupId.ok) return conversionGroupId;
  const coverAssetId = readOptionalId(value.coverAssetId, 'coverAssetId', '封面图');
  if (!coverAssetId.ok) return coverAssetId;
  const mediaAssetIds = readMediaIds(value.mediaAssetIds);
  if (!mediaAssetIds.ok) return mediaAssetIds;
  if (coverAssetId.value && !mediaAssetIds.value.includes(coverAssetId.value)) {
    return { ok: false, field: 'coverAssetId', message: '封面图必须来自当前产品图片。' };
  }
  if (typeof value.isFeatured !== 'boolean') {
    return { ok: false, field: 'isFeatured', message: '热门状态无效。' };
  }
  const featuredOrder = readOrder(value.featuredOrder, 'featuredOrder', '热门排序');
  if (!featuredOrder.ok) return featuredOrder;
  const sortOrder = readOrder(value.sortOrder, 'sortOrder', '产品排序');
  if (!sortOrder.ok) return sortOrder;
  if (value.status !== 'draft' && value.status !== 'published' && value.status !== 'archived') {
    return { ok: false, field: 'status', message: '产品发布状态无效。' };
  }

  return {
    ok: true,
    value: {
      serviceMode: value.serviceMode,
      title: title.value,
      body: body.value,
      address: value.serviceMode === 'offline' ? address.value : null,
      categoryId: categoryId.value,
      conversionGroupId: conversionGroupId.value,
      coverAssetId: coverAssetId.value,
      mediaAssetIds: mediaAssetIds.value,
      isFeatured: value.isFeatured,
      featuredOrder: featuredOrder.value,
      sortOrder: sortOrder.value,
      status: value.status,
    },
  };
}

function buildPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function validateProductDependencies(
  db: D1Database,
  sectionId: string,
  input: ProductInput,
): Promise<ProductDependencyValidation> {
  if (input.categoryId) {
    const category = await getCategory(db, sectionId, input.categoryId);
    if (!category || category.deletedAt) {
      return { ok: false, field: 'categoryId', code: 'CATEGORY_NOT_FOUND', message: '所选分类不存在于当前分区。' };
    }
    if (input.status === 'published' && !category.isEnabled) {
      return { ok: false, field: 'categoryId', code: 'CATEGORY_DISABLED', message: '发布产品不能使用已停用分类。' };
    }
  }

  if (input.conversionGroupId) {
    const group = await getConversionGroup(db, sectionId, input.conversionGroupId);
    if (!group || group.deletedAt) {
      return { ok: false, field: 'conversionGroupId', code: 'CONVERSION_GROUP_NOT_FOUND', message: '所选转化分组不存在于当前分区。' };
    }
    const requiredMode: ConversionMode =
      input.serviceMode === 'online' ? 'link' : 'customer_service';
    if (group.mode !== requiredMode) {
      return {
        ok: false,
        field: 'conversionGroupId',
        code: 'CONVERSION_MODE_MISMATCH',
        message:
          input.serviceMode === 'online'
            ? '线上服务只能选择外部链接分组。'
            : '线下服务只能选择在线客服分组。',
      };
    }
    if (input.status === 'published' && !group.isEnabled) {
      return { ok: false, field: 'conversionGroupId', code: 'CONVERSION_GROUP_DISABLED', message: '发布产品不能使用已停用转化分组。' };
    }
    if (input.status === 'published' && group.activeTargetCount < 1) {
      return { ok: false, field: 'conversionGroupId', code: 'CONVERSION_TARGET_REQUIRED', message: '发布前请为转化分组配置至少一个启用入口。' };
    }
  }

  if (input.status === 'published' && input.serviceMode === 'offline' && !input.address) {
    return { ok: false, field: 'address', code: 'ADDRESS_REQUIRED', message: '发布线下服务必须填写服务地址。' };
  }
  if (input.status === 'published' && input.mediaAssetIds.length === 0) {
    return { ok: false, field: 'mediaAssetIds', code: 'PRODUCT_IMAGE_REQUIRED', message: '发布产品至少需要一张图片。' };
  }

  if (input.mediaAssetIds.length > 0) {
    const rows = await db
      .prepare(
        `SELECT id FROM media_assets
         WHERE id IN (${buildPlaceholders(input.mediaAssetIds.length)})
           AND status = 'ready'
           AND deleted_at IS NULL`,
      )
      .bind(...input.mediaAssetIds)
      .all<{ id: string }>();
    if (rows.results.length !== input.mediaAssetIds.length) {
      return { ok: false, field: 'mediaAssetIds', code: 'PRODUCT_IMAGE_INVALID', message: '部分产品图片已不存在或不可用，请重新上传。' };
    }
  }

  return { ok: true };
}

function mapProduct(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    sectionId: row.section_id,
    slug: row.slug,
    serviceMode: row.service_mode,
    title: row.title,
    body: row.body,
    address: row.address,
    categoryId: row.category_id,
    categoryName: row.category_name,
    conversionGroupId: row.conversion_group_id,
    conversionGroupName: row.conversion_group_name,
    conversionMode: row.conversion_mode,
    buttonLabel: row.button_label,
    coverAssetId: row.cover_asset_id,
    effectiveCoverAssetId: row.effective_cover_asset_id,
    effectiveCoverUrl: row.effective_cover_object_key
      ? buildAssetPublicUrl(row.media_base_url, row.effective_cover_object_key)
      : null,
    media: [],
    isFeatured: row.is_featured === 1,
    featuredOrder: row.featured_order,
    sortOrder: row.sort_order,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const PRODUCT_SELECT = `SELECT
  p.id,
  p.section_id,
  p.slug,
  p.service_mode,
  p.title,
  p.body,
  p.address,
  p.category_id,
  c.name AS category_name,
  p.conversion_group_id,
  cg.name AS conversion_group_name,
  cg.mode AS conversion_mode,
  cg.button_label,
  p.cover_asset_id,
  COALESCE(
    p.cover_asset_id,
    (SELECT pm.media_asset_id FROM product_media pm
     WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC LIMIT 1)
  ) AS effective_cover_asset_id,
  ma.object_key AS effective_cover_object_key,
  p.is_featured,
  p.featured_order,
  p.sort_order,
  p.status,
  p.published_at,
  p.created_at,
  p.updated_at,
  p.deleted_at,
  ss.media_base_url
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN conversion_groups cg ON cg.id = p.conversion_group_id
LEFT JOIN media_assets ma ON ma.id = COALESCE(
  p.cover_asset_id,
  (SELECT pm.media_asset_id FROM product_media pm
   WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC LIMIT 1)
)
CROSS JOIN site_settings ss`;

export async function listProducts(
  db: D1Database,
  sectionId: string,
  scope: ProductScope,
): Promise<ProductRecord[]> {
  const scopeClause =
    scope === 'active'
      ? 'AND p.deleted_at IS NULL'
      : scope === 'trash'
        ? 'AND p.deleted_at IS NOT NULL'
        : '';
  const result = await db
    .prepare(
      `${PRODUCT_SELECT}
       WHERE p.section_id = ? ${scopeClause}
       ORDER BY p.sort_order ASC, p.updated_at DESC`,
    )
    .bind(sectionId)
    .all<ProductRow>();
  return result.results.map(mapProduct);
}

async function listProductMedia(
  db: D1Database,
  productId: string,
  mediaBaseUrl: string | null,
): Promise<ProductMediaRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         ma.id,
         ma.object_key,
         ma.file_name,
         ma.mime_type,
         ma.byte_size,
         ma.width,
         ma.height,
         pm.sort_order,
         pm.alt_text
       FROM product_media pm
       JOIN media_assets ma ON ma.id = pm.media_asset_id
       WHERE pm.product_id = ?
       ORDER BY pm.sort_order ASC`,
    )
    .bind(productId)
    .all<ProductMediaRow>();
  return result.results.map((row) => ({
    id: row.id,
    objectKey: row.object_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    altText: row.alt_text,
    publicUrl: buildAssetPublicUrl(mediaBaseUrl, row.object_key),
  }));
}

export async function getProduct(
  db: D1Database,
  sectionId: string,
  productId: string,
): Promise<ProductRecord | null> {
  const row = await db
    .prepare(`${PRODUCT_SELECT} WHERE p.section_id = ? AND p.id = ?`)
    .bind(sectionId, productId)
    .first<ProductRow>();
  if (!row) return null;
  const product = mapProduct(row);
  product.media = await listProductMedia(db, product.id, row.media_base_url);
  return product;
}

function slugBase(title: string): string {
  const normalized = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return normalized || 'product';
}

export function createProduct(
  db: D1Database,
  sectionId: string,
  input: ProductInput,
  now: string,
): { product: ProductRecord; statements: D1PreparedStatement[] } {
  const id = crypto.randomUUID();
  const publishedAt = input.status === 'published' ? now : null;
  const product: ProductRecord = {
    id,
    sectionId,
    slug: `${slugBase(input.title)}-${id.slice(0, 8)}`,
    serviceMode: input.serviceMode,
    title: input.title,
    body: input.body,
    address: input.address,
    categoryId: input.categoryId,
    categoryName: null,
    conversionGroupId: input.conversionGroupId,
    conversionGroupName: null,
    conversionMode: null,
    buttonLabel: null,
    coverAssetId: input.coverAssetId,
    effectiveCoverAssetId: input.coverAssetId ?? input.mediaAssetIds[0] ?? null,
    effectiveCoverUrl: null,
    media: [],
    isFeatured: input.isFeatured,
    featuredOrder: input.featuredOrder,
    sortOrder: input.sortOrder,
    status: input.status,
    publishedAt,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO products (
           id, section_id, slug, service_mode, title, body, address,
           cover_asset_id, conversion_method_id, is_featured, featured_order,
           status, published_at, created_at, updated_at, deleted_at,
           category_id, conversion_group_id, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      )
      .bind(
        product.id,
        product.sectionId,
        product.slug,
        product.serviceMode,
        product.title,
        product.body,
        product.address,
        product.coverAssetId,
        product.isFeatured ? 1 : 0,
        product.featuredOrder,
        product.status,
        product.publishedAt,
        product.createdAt,
        product.updatedAt,
        product.categoryId,
        product.conversionGroupId,
        product.sortOrder,
      ),
  ];
  input.mediaAssetIds.forEach((assetId, index) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO product_media (
             product_id, media_asset_id, sort_order, alt_text, created_at
           ) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(product.id, assetId, index * 10, product.title, now),
    );
  });
  return { product, statements };
}

export function createUpdateProductStatements(
  db: D1Database,
  current: ProductRecord,
  input: ProductInput,
  now: string,
): D1PreparedStatement[] {
  const publishedAt =
    input.status === 'published' ? current.publishedAt ?? now : current.publishedAt;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE products
         SET service_mode = ?, title = ?, body = ?, address = ?, category_id = ?,
             conversion_group_id = ?, cover_asset_id = ?, is_featured = ?,
             featured_order = ?, sort_order = ?, status = ?, published_at = ?, updated_at = ?
         WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
      )
      .bind(
        input.serviceMode,
        input.title,
        input.body,
        input.address,
        input.categoryId,
        input.conversionGroupId,
        input.coverAssetId,
        input.isFeatured ? 1 : 0,
        input.featuredOrder,
        input.sortOrder,
        input.status,
        publishedAt,
        now,
        current.sectionId,
        current.id,
      ),
    db.prepare('DELETE FROM product_media WHERE product_id = ?').bind(current.id),
  ];
  input.mediaAssetIds.forEach((assetId, index) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO product_media (
             product_id, media_asset_id, sort_order, alt_text, created_at
           ) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(current.id, assetId, index * 10, input.title, now),
    );
  });
  return statements;
}

export function createDeleteProductStatement(
  db: D1Database,
  sectionId: string,
  productId: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE products
       SET deleted_at = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, sectionId, productId);
}

export function createRestoreProductStatement(
  db: D1Database,
  sectionId: string,
  productId: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE products
       SET deleted_at = NULL, status = 'draft', published_at = NULL, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, sectionId, productId);
}

export function createReorderProductStatement(
  db: D1Database,
  sectionId: string,
  productId: string,
  sortOrder: number,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE products
       SET sort_order = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(sortOrder, now, sectionId, productId);
}

export async function hydrateProduct(
  db: D1Database,
  product: ProductRecord,
): Promise<ProductRecord> {
  return (await getProduct(db, product.sectionId, product.id)) ?? product;
}

export async function getProductMediaBaseUrl(db: D1Database): Promise<string | null> {
  return getMediaBaseUrl(db);
}

export function isProductConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('products_active_slug_unique') ||
      error.message.includes('UNIQUE constraint failed: products.section_id, products.slug'))
  );
}
