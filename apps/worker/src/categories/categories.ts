export type CategoryRecord = {
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

export type CategoryInput = {
  name: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type CategoryScope = 'active' | 'trash' | 'all';

type CategoryRow = {
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
  | { ok: true; value: CategoryInput }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateCategoryInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '分类数据无效。' };
  }

  if (typeof value.name !== 'string' || !value.name.trim()) {
    return { ok: false, field: 'name', message: '请填写分类名称。' };
  }
  const name = value.name.trim();
  if (name.length > 100) {
    return { ok: false, field: 'name', message: '分类名称不能超过 100 个字符。' };
  }

  if (
    typeof value.sortOrder !== 'number' ||
    !Number.isInteger(value.sortOrder) ||
    value.sortOrder < 0 ||
    value.sortOrder > 1_000_000
  ) {
    return {
      ok: false,
      field: 'sortOrder',
      message: '排序必须是 0 到 1000000 的整数。',
    };
  }

  if (typeof value.isEnabled !== 'boolean') {
    return { ok: false, field: 'isEnabled', message: '必须选择启用或停用。' };
  }

  return {
    ok: true,
    value: {
      name,
      sortOrder: value.sortOrder,
      isEnabled: value.isEnabled,
    },
  };
}

function mapCategory(row: CategoryRow): CategoryRecord {
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

const CATEGORY_SELECT = `SELECT
  c.id,
  c.section_id,
  c.name,
  c.sort_order,
  c.is_enabled,
  c.created_at,
  c.updated_at,
  c.deleted_at,
  (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
FROM categories c`;

export async function listCategories(
  db: D1Database,
  sectionId: string,
  scope: CategoryScope,
): Promise<CategoryRecord[]> {
  const deletedClause =
    scope === 'active'
      ? 'AND c.deleted_at IS NULL'
      : scope === 'trash'
        ? 'AND c.deleted_at IS NOT NULL'
        : '';
  const result = await db
    .prepare(
      `${CATEGORY_SELECT}
       WHERE c.section_id = ? ${deletedClause}
       ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC`,
    )
    .bind(sectionId)
    .all<CategoryRow>();

  return result.results.map(mapCategory);
}

export async function getCategory(
  db: D1Database,
  sectionId: string,
  id: string,
): Promise<CategoryRecord | null> {
  const row = await db
    .prepare(`${CATEGORY_SELECT} WHERE c.section_id = ? AND c.id = ?`)
    .bind(sectionId, id)
    .first<CategoryRow>();
  return row ? mapCategory(row) : null;
}

export function createCategory(
  db: D1Database,
  sectionId: string,
  input: CategoryInput,
  now: string,
): { category: CategoryRecord; statement: D1PreparedStatement } {
  const category: CategoryRecord = {
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
    category,
    statement: db
      .prepare(
        `INSERT INTO categories (
           id, section_id, name, sort_order, is_enabled, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        category.id,
        category.sectionId,
        category.name,
        category.sortOrder,
        category.isEnabled ? 1 : 0,
        category.createdAt,
        category.updatedAt,
      ),
  };
}

export function createUpdateCategoryStatement(
  db: D1Database,
  sectionId: string,
  id: string,
  input: CategoryInput,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE categories
       SET name = ?, sort_order = ?, is_enabled = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(input.name, input.sortOrder, input.isEnabled ? 1 : 0, now, sectionId, id);
}

export function createDeleteCategoryStatement(
  db: D1Database,
  sectionId: string,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE categories
       SET is_enabled = 0, deleted_at = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, sectionId, id);
}

export function createRestoreCategoryStatement(
  db: D1Database,
  sectionId: string,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE categories
       SET deleted_at = NULL, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, sectionId, id);
}

export function createReorderCategoryStatement(
  db: D1Database,
  sectionId: string,
  id: string,
  sortOrder: number,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE categories
       SET sort_order = ?, updated_at = ?
       WHERE section_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(sortOrder, now, sectionId, id);
}

export function hasCategoryDependencies(category: CategoryRecord): boolean {
  return category.productCount > 0;
}

export function isCategoryConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('categories_active_name_unique') ||
      error.message.includes('UNIQUE constraint failed: index') ||
      error.message.includes('UNIQUE constraint failed: categories.section_id, categories.name'))
  );
}
