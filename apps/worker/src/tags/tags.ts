export type ProductTagRecord = {
  id: string;
  sectionId: string;
  name: string;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  productCount: number;
};

export type ProductTagInput = {
  name: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type ProductTagScope = 'active' | 'trash' | 'all';

type ProductTagRow = {
  id: string;
  section_id: string;
  name: string;
  sort_order: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  product_count: number;
};

type ValidationResult =
  { ok: true; value: ProductTagInput } | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateProductTagInput(value: unknown): ValidationResult {
  if (!isRecord(value)) return { ok: false, field: 'form', message: '标签数据无效。' };
  if (typeof value.name !== 'string' || !value.name.trim()) {
    return { ok: false, field: 'name', message: '请填写标签名称。' };
  }
  const name = value.name.trim();
  if (name.length > 80) {
    return { ok: false, field: 'name', message: '标签名称不能超过 80 个字符。' };
  }
  if (
    typeof value.sortOrder !== 'number' ||
    !Number.isInteger(value.sortOrder) ||
    value.sortOrder < 0 ||
    value.sortOrder > 1_000_000
  ) {
    return { ok: false, field: 'sortOrder', message: '排序必须是 0 到 1000000 的整数。' };
  }
  if (typeof value.isEnabled !== 'boolean') {
    return { ok: false, field: 'isEnabled', message: '必须选择启用或停用。' };
  }
  return {
    ok: true,
    value: { name, sortOrder: value.sortOrder, isEnabled: value.isEnabled },
  };
}

function mapProductTag(row: ProductTagRow): ProductTagRecord {
  return {
    id: row.id,
    sectionId: row.section_id,
    name: row.name,
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    productCount: row.product_count,
  };
}

const TAG_SELECT = `SELECT
  t.id,
  t.section_id,
  t.name,
  t.sort_order,
  t.is_enabled,
  t.created_at,
  t.updated_at,
  t.deleted_at,
  (SELECT COUNT(*) FROM product_tag_bindings b
   JOIN products p ON p.id = b.product_id
   WHERE b.tag_id = t.id AND p.deleted_at IS NULL) AS product_count
FROM product_tags_catalog t`;

export async function listProductTags(
  db: D1Database,
  sectionId: string,
  scope: ProductTagScope,
): Promise<ProductTagRecord[]> {
  const deletedClause =
    scope === 'active'
      ? 'AND t.deleted_at IS NULL'
      : scope === 'trash'
        ? 'AND t.deleted_at IS NOT NULL'
        : '';
  const rows = (
    await db
      .prepare(
        `${TAG_SELECT}
         WHERE t.section_id = ? ${deletedClause}
         ORDER BY t.sort_order ASC, t.name COLLATE NOCASE ASC`,
      )
      .bind(sectionId)
      .all<ProductTagRow>()
  ).results;
  return rows.map(mapProductTag);
}

export async function getProductTag(
  db: D1Database,
  sectionId: string,
  id: string,
): Promise<ProductTagRecord | null> {
  const row = await db
    .prepare(`${TAG_SELECT} WHERE t.section_id = ? AND t.id = ?`)
    .bind(sectionId, id)
    .first<ProductTagRow>();
  return row ? mapProductTag(row) : null;
}

export function createProductTag(
  db: D1Database,
  sectionId: string,
  input: ProductTagInput,
  now: string,
): { tag: ProductTagRecord; statement: D1PreparedStatement } {
  const tag: ProductTagRecord = {
    id: crypto.randomUUID(),
    sectionId,
    name: input.name,
    sortOrder: input.sortOrder,
    isEnabled: input.isEnabled,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    productCount: 0,
  };
  return {
    tag,
    statement: db
      .prepare(
        `INSERT INTO product_tags_catalog (
           id, section_id, name, sort_order, is_enabled, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        tag.id,
        tag.sectionId,
        tag.name,
        tag.sortOrder,
        tag.isEnabled ? 1 : 0,
        tag.createdAt,
        tag.updatedAt,
      ),
  };
}

export function createUpdateProductTagStatement(
  db: D1Database,
  sectionId: string,
  id: string,
  input: ProductTagInput,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE product_tags_catalog
       SET name = ?, sort_order = ?, is_enabled = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(input.name, input.sortOrder, input.isEnabled ? 1 : 0, now, sectionId, id);
}

export function createDeleteProductTagStatement(
  db: D1Database,
  sectionId: string,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE product_tags_catalog
       SET is_enabled = 0, deleted_at = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, sectionId, id);
}

export function createRestoreProductTagStatement(
  db: D1Database,
  sectionId: string,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE product_tags_catalog
       SET deleted_at = NULL, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, sectionId, id);
}

export function createReorderProductTagStatement(
  db: D1Database,
  sectionId: string,
  id: string,
  sortOrder: number,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE product_tags_catalog
       SET sort_order = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(sortOrder, now, sectionId, id);
}

export function hasProductTagDependencies(tag: ProductTagRecord): boolean {
  return tag.productCount > 0;
}

export function isProductTagConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('product_tags_catalog_active_name_unique') ||
      error.message.includes('UNIQUE constraint failed: product_tags_catalog.section_id'))
  );
}
