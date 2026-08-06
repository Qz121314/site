import { buildAssetPublicUrl } from '../assets/asset-library';

export type SectionRecord = {
  id: string;
  slug: string;
  name: string;
  iconType: 'icon' | 'asset';
  iconValue: string | null;
  iconAssetId: string | null;
  iconUrl: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  productCount: number;
  conversionMethodCount: number;
};

export type SectionInput = {
  name: string;
  iconValue: string | null;
  iconAssetId: string | null;
  sortOrder: number;
  isEnabled: boolean;
};

export type SectionScope = 'active' | 'trash' | 'all';

type SectionRow = {
  id: string;
  slug: string;
  name: string;
  icon_type: 'icon' | 'asset';
  icon_value: string | null;
  icon_asset_id: string | null;
  icon_object_key: string | null;
  media_base_url: string | null;
  sort_order: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  product_count: number;
  conversion_method_count: number;
};

type ValidationResult =
  | { ok: true; value: SectionInput }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
): { ok: true; value: string } | { ok: false; field: string; message: string } {
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
): { ok: true; value: string | null } | { ok: false; field: string; message: string } {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
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

function optionalAssetUrl(mediaBaseUrl: string | null, key: string | null): string | null {
  return key ? buildAssetPublicUrl(mediaBaseUrl, key) : null;
}

export function validateSectionInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '分区数据无效。' };
  }

  const name = readText(value.name, 'name', '分区名称', 100);
  if (!name.ok) return name;
  const iconValue = readOptionalText(value.iconValue, 'iconValue', '分区字符图标', 80);
  if (!iconValue.ok) return iconValue;
  const iconAssetId = readOptionalText(value.iconAssetId, 'iconAssetId', '分区图片图标', 100);
  if (!iconAssetId.ok) return iconAssetId;
  if (!iconAssetId.value && !iconValue.value) {
    return { ok: false, field: 'iconValue', message: '请上传分区图标或选择一个备用字符图标。' };
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
    value: {
      name: name.value,
      iconValue: iconValue.value,
      iconAssetId: iconAssetId.value,
      sortOrder: value.sortOrder,
      isEnabled: value.isEnabled,
    },
  };
}

function mapSection(row: SectionRow): SectionRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    iconType: row.icon_type,
    iconValue: row.icon_value,
    iconAssetId: row.icon_asset_id,
    iconUrl: optionalAssetUrl(row.media_base_url, row.icon_object_key),
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    productCount: row.product_count,
    conversionMethodCount: row.conversion_method_count,
  };
}

const SECTION_SELECT = `SELECT
  s.id,
  s.slug,
  s.name,
  s.icon_type,
  s.icon_value,
  s.icon_asset_id,
  icon.object_key AS icon_object_key,
  settings.media_base_url,
  s.sort_order,
  s.is_enabled,
  s.created_at,
  s.updated_at,
  s.deleted_at,
  (SELECT COUNT(*) FROM products p WHERE p.section_id = s.id AND p.deleted_at IS NULL) AS product_count,
  (SELECT COUNT(*) FROM conversion_methods c WHERE c.section_id = s.id AND c.deleted_at IS NULL) AS conversion_method_count
FROM sections s
LEFT JOIN media_assets icon
  ON icon.id = s.icon_asset_id
 AND icon.status = 'ready'
 AND icon.deleted_at IS NULL
LEFT JOIN site_settings settings ON settings.id = 1`;

export async function listSections(
  db: D1Database,
  scope: SectionScope,
): Promise<SectionRecord[]> {
  const whereClause =
    scope === 'active'
      ? 'WHERE s.deleted_at IS NULL'
      : scope === 'trash'
        ? 'WHERE s.deleted_at IS NOT NULL'
        : '';
  const result = await db
    .prepare(`${SECTION_SELECT} ${whereClause} ORDER BY s.sort_order ASC, s.name COLLATE NOCASE ASC`)
    .all<SectionRow>();
  return result.results.map(mapSection);
}

export async function getSection(
  db: D1Database,
  id: string,
): Promise<SectionRecord | null> {
  const row = await db
    .prepare(`${SECTION_SELECT} WHERE s.id = ?`)
    .bind(id)
    .first<SectionRow>();
  return row ? mapSection(row) : null;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

async function createUniqueSlug(db: D1Database, name: string, id: string): Promise<string> {
  const base = slugify(name) || `section-${id.slice(0, 8)}`;
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const existing = await db
      .prepare('SELECT id FROM sections WHERE lower(slug) = lower(?) AND deleted_at IS NULL')
      .bind(candidate)
      .first<{ id: string }>();
    if (!existing) return candidate;
  }
  return `${base}-${id.slice(0, 8)}`;
}

export async function createSectionStatements(
  db: D1Database,
  input: SectionInput,
  now: string,
): Promise<{ section: SectionRecord; statements: D1PreparedStatement[] }> {
  const id = crypto.randomUUID();
  const slug = await createUniqueSlug(db, input.name, id);
  const iconType = input.iconAssetId ? 'asset' : 'icon';
  const section: SectionRecord = {
    id,
    slug,
    name: input.name,
    iconType,
    iconValue: input.iconAssetId ? null : input.iconValue,
    iconAssetId: input.iconAssetId,
    iconUrl: null,
    sortOrder: input.sortOrder,
    isEnabled: input.isEnabled,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    productCount: 0,
    conversionMethodCount: 0,
  };

  return {
    section,
    statements: [
      db
        .prepare(
          `INSERT INTO sections (
             id, slug, name, icon_type, icon_value, icon_asset_id,
             sort_order, is_enabled, created_at, updated_at, deleted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .bind(
          section.id,
          section.slug,
          section.name,
          section.iconType,
          section.iconValue,
          section.iconAssetId,
          section.sortOrder,
          section.isEnabled ? 1 : 0,
          section.createdAt,
          section.updatedAt,
        ),
    ],
  };
}

export function createUpdateSectionStatement(
  db: D1Database,
  id: string,
  input: SectionInput,
  now: string,
): D1PreparedStatement {
  const iconType = input.iconAssetId ? 'asset' : 'icon';
  return db
    .prepare(
      `UPDATE sections
       SET name = ?, icon_type = ?, icon_value = ?, icon_asset_id = ?,
           sort_order = ?, is_enabled = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(
      input.name,
      iconType,
      input.iconAssetId ? null : input.iconValue,
      input.iconAssetId,
      input.sortOrder,
      input.isEnabled ? 1 : 0,
      now,
      id,
    );
}

export function createDeleteSectionStatement(
  db: D1Database,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE sections
       SET is_enabled = 0, deleted_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, id);
}

export function createRestoreSectionStatement(
  db: D1Database,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE sections SET deleted_at = NULL, updated_at = ?
       WHERE id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, id);
}

export function createReorderSectionStatement(
  db: D1Database,
  id: string,
  sortOrder: number,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE sections SET sort_order = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(sortOrder, now, id);
}

export function hasSectionDependencies(section: SectionRecord): boolean {
  return section.productCount > 0 || section.conversionMethodCount > 0;
}

export function isSectionConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('sections_active_name_unique') ||
      error.message.includes('UNIQUE constraint failed: sections.name') ||
      error.message.includes('UNIQUE constraint failed: index'))
  );
}
