import type { ProductStatus } from './products';

export const MAX_PRODUCT_TAGS = 12;

export type BoundProductTag = {
  id: string;
  name: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type PublicProductTag = {
  id: string;
  sectionId: string;
  name: string;
  sortOrder: number;
};

type BoundProductTagRow = {
  product_id: string;
  id: string;
  name: string;
  sort_order: number;
  is_enabled: number;
};

type PublicProductTagRow = {
  id: string;
  section_id: string;
  name: string;
  sort_order: number;
};

type TagValidationRow = {
  id: string;
  section_id: string;
  is_enabled: number;
  deleted_at: string | null;
};

export function parseProductTagIds(
  value: unknown,
): { ok: true; value: string[] } | { ok: false; field: 'tagIds'; message: string } {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, field: 'tagIds', message: '产品标签列表无效。' };
  }
  if (value.length > MAX_PRODUCT_TAGS) {
    return {
      ok: false,
      field: 'tagIds',
      message: `每个产品最多选择 ${MAX_PRODUCT_TAGS} 个标签。`,
    };
  }
  const ids = value.filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100,
  );
  if (ids.length !== value.length || new Set(ids).size !== ids.length) {
    return { ok: false, field: 'tagIds', message: '产品标签列表包含无效或重复标签。' };
  }
  return { ok: true, value: ids };
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function validateProductTagBindings(
  db: D1Database,
  sectionId: string,
  tagIds: string[],
  status: ProductStatus,
): Promise<{ ok: true } | { ok: false; field: 'tagIds'; code: string; message: string }> {
  if (tagIds.length === 0) return { ok: true };
  const rows = (
    await db
      .prepare(
        `SELECT id, section_id, is_enabled, deleted_at
         FROM product_tags_catalog
         WHERE id IN (${placeholders(tagIds.length)})`,
      )
      .bind(...tagIds)
      .all<TagValidationRow>()
  ).results;
  if (
    rows.length !== tagIds.length ||
    rows.some((tag) => tag.section_id !== sectionId || tag.deleted_at)
  ) {
    return {
      ok: false,
      field: 'tagIds',
      code: 'PRODUCT_TAG_INVALID',
      message: '部分产品标签不存在于当前分区或已进入回收站。',
    };
  }
  if (status === 'published' && rows.some((tag) => tag.is_enabled !== 1)) {
    return {
      ok: false,
      field: 'tagIds',
      code: 'PRODUCT_TAG_DISABLED',
      message: '发布产品不能使用已停用标签。',
    };
  }
  return { ok: true };
}

export function createReplaceProductTagStatements(
  db: D1Database,
  productId: string,
  tagIds: string[],
  now: string,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM product_tag_bindings WHERE product_id = ?').bind(productId),
  ];
  tagIds.forEach((tagId) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO product_tag_bindings (product_id, tag_id, created_at)
           VALUES (?, ?, ?)`,
        )
        .bind(productId, tagId, now),
    );
  });
  return statements;
}

export async function getProductTags(
  db: D1Database,
  productId: string,
): Promise<BoundProductTag[]> {
  const rows = (
    await db
      .prepare(
        `SELECT
           b.product_id,
           t.id,
           t.name,
           t.sort_order,
           t.is_enabled
         FROM product_tag_bindings b
         JOIN product_tags_catalog t ON t.id = b.tag_id
         WHERE b.product_id = ? AND t.deleted_at IS NULL
         ORDER BY t.sort_order ASC, t.name COLLATE NOCASE ASC`,
      )
      .bind(productId)
      .all<BoundProductTagRow>()
  ).results;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled === 1,
  }));
}

export async function listProductTagsByProductIds(
  db: D1Database,
  productIds: string[],
  enabledOnly = false,
): Promise<Map<string, BoundProductTag[]>> {
  const result = new Map<string, BoundProductTag[]>();
  if (productIds.length === 0) return result;
  const rows = (
    await db
      .prepare(
        `SELECT
           b.product_id,
           t.id,
           t.name,
           t.sort_order,
           t.is_enabled
         FROM product_tag_bindings b
         JOIN product_tags_catalog t ON t.id = b.tag_id
         WHERE b.product_id IN (${placeholders(productIds.length)})
           AND t.deleted_at IS NULL
           ${enabledOnly ? 'AND t.is_enabled = 1' : ''}
         ORDER BY b.product_id, t.sort_order ASC, t.name COLLATE NOCASE ASC`,
      )
      .bind(...productIds)
      .all<BoundProductTagRow>()
  ).results;
  for (const row of rows) {
    const current = result.get(row.product_id) ?? [];
    current.push({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
      isEnabled: row.is_enabled === 1,
    });
    result.set(row.product_id, current);
  }
  return result;
}

export async function listEnabledPublicProductTags(
  db: D1Database,
): Promise<PublicProductTag[]> {
  const rows = (
    await db
      .prepare(
        `SELECT t.id, t.section_id, t.name, t.sort_order
         FROM product_tags_catalog t
         JOIN sections s ON s.id = t.section_id
         WHERE t.deleted_at IS NULL
           AND t.is_enabled = 1
           AND s.deleted_at IS NULL
           AND s.is_enabled = 1
         ORDER BY t.section_id, t.sort_order ASC, t.name COLLATE NOCASE ASC`,
      )
      .all<PublicProductTagRow>()
  ).results;
  return rows.map((row) => ({
    id: row.id,
    sectionId: row.section_id,
    name: row.name,
    sortOrder: row.sort_order,
  }));
}

export type ProductWithTags<T> = T & {
  tags: BoundProductTag[];
  tagIds: string[];
};

export async function hydrateProductWithTags<T extends { id: string }>(
  db: D1Database,
  product: T,
): Promise<ProductWithTags<T>> {
  const tags = await getProductTags(db, product.id);
  return { ...product, tags, tagIds: tags.map((tag) => tag.id) };
}

export async function hydrateProductsWithTags<T extends { id: string }>(
  db: D1Database,
  products: T[],
): Promise<Array<ProductWithTags<T>>> {
  const tagsByProduct = await listProductTagsByProductIds(
    db,
    products.map((product) => product.id),
  );
  return products.map((product) => {
    const tags = tagsByProduct.get(product.id) ?? [];
    return { ...product, tags, tagIds: tags.map((tag) => tag.id) };
  });
}
