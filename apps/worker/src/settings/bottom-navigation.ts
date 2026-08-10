export const BOTTOM_NAVIGATION_KEYS = ['home', 'browse', 'messages', 'faq'] as const;
export type BottomNavigationKey = (typeof BOTTOM_NAVIGATION_KEYS)[number];

export const BOTTOM_NAVIGATION_BUILTIN_ICONS = [
  'home',
  'compass',
  'messages',
  'help',
  'grid',
  'search',
  'star',
  'heart',
  'user',
  'menu',
  'bell',
  'map',
] as const;
export type BottomNavigationBuiltinIcon =
  (typeof BOTTOM_NAVIGATION_BUILTIN_ICONS)[number];
export type BottomNavigationIconType = 'builtin' | 'emoji' | 'asset';

export type BottomNavigationItem = {
  key: BottomNavigationKey;
  label: string;
  iconType: BottomNavigationIconType;
  iconValue: string | null;
  iconAssetId: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type BottomNavigationInput = Array<Omit<BottomNavigationItem, 'sortOrder'>>;

type BottomNavigationRow = {
  item_key: BottomNavigationKey;
  label: string;
  icon_type: BottomNavigationIconType;
  icon_value: string | null;
  icon_asset_id: string | null;
  is_enabled: number;
  sort_order: number;
};

type ReadyNavigationAssetRow = {
  id: string;
  object_key: string;
};

type ValidationResult =
  | { ok: true; provided: false; value: null }
  | { ok: true; provided: true; value: BottomNavigationInput }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBottomNavigationKey(value: unknown): value is BottomNavigationKey {
  return (
    typeof value === 'string' &&
    BOTTOM_NAVIGATION_KEYS.includes(value as BottomNavigationKey)
  );
}

function isBuiltinIcon(value: unknown): value is BottomNavigationBuiltinIcon {
  return (
    typeof value === 'string' &&
    BOTTOM_NAVIGATION_BUILTIN_ICONS.includes(value as BottomNavigationBuiltinIcon)
  );
}

function normalizeLabel(
  value: unknown,
  field: string,
): { ok: true; value: string } | { ok: false; field: string; message: string } {
  if (typeof value !== 'string')
    return { ok: false, field, message: '导航名称必须填写文本。' };
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 24) {
    return { ok: false, field, message: '导航名称长度必须在 1 到 24 个字符之间。' };
  }
  return { ok: true, value: normalized };
}

function normalizeEmoji(
  value: unknown,
  field: string,
): { ok: true; value: string } | { ok: false; field: string; message: string } {
  if (typeof value !== 'string') return { ok: false, field, message: '请填写 Emoji。' };
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 16) {
    return { ok: false, field, message: 'Emoji 长度必须在 1 到 16 个字符之间。' };
  }
  return { ok: true, value: normalized };
}

export function validateBottomNavigationInput(value: unknown): ValidationResult {
  if (value === undefined) return { ok: true, provided: false, value: null };
  if (!Array.isArray(value) || value.length !== BOTTOM_NAVIGATION_KEYS.length) {
    return {
      ok: false,
      field: 'bottomNavigation',
      message: '底部导航必须包含 Home、Browse、Messages、FAQ 四个固定入口。',
    };
  }

  const seen = new Set<BottomNavigationKey>();
  const normalized: BottomNavigationInput = [];

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const field = `bottomNavigation.${index}`;
    if (!isRecord(item) || !isBottomNavigationKey(item.key) || seen.has(item.key)) {
      return { ok: false, field, message: '底部导航入口无效或重复。' };
    }
    seen.add(item.key);

    const label = normalizeLabel(item.label, `${field}.label`);
    if (!label.ok) return label;
    if (typeof item.enabled !== 'boolean') {
      return { ok: false, field: `${field}.enabled`, message: '请选择是否显示该导航。' };
    }
    if (
      item.iconType !== 'builtin' &&
      item.iconType !== 'emoji' &&
      item.iconType !== 'asset'
    ) {
      return { ok: false, field: `${field}.iconType`, message: '导航图标类型无效。' };
    }

    let iconValue: string | null = null;
    let iconAssetId: string | null = null;
    if (item.iconType === 'builtin') {
      if (!isBuiltinIcon(item.iconValue)) {
        return {
          ok: false,
          field: `${field}.iconValue`,
          message: '请选择有效的内置图标。',
        };
      }
      iconValue = item.iconValue;
    } else if (item.iconType === 'emoji') {
      const emoji = normalizeEmoji(item.iconValue, `${field}.iconValue`);
      if (!emoji.ok) return emoji;
      iconValue = emoji.value;
    } else {
      if (
        typeof item.iconAssetId !== 'string' ||
        !item.iconAssetId.trim() ||
        item.iconAssetId.length > 100
      ) {
        return {
          ok: false,
          field: `${field}.iconAssetId`,
          message: '请选择有效的导航图片。',
        };
      }
      iconAssetId = item.iconAssetId.trim();
    }

    normalized.push({
      key: item.key,
      label: label.value,
      iconType: item.iconType,
      iconValue,
      iconAssetId,
      enabled: item.enabled,
    });
  }

  for (const key of BOTTOM_NAVIGATION_KEYS) {
    if (!seen.has(key)) {
      return {
        ok: false,
        field: 'bottomNavigation',
        message: `底部导航缺少 ${key} 入口。`,
      };
    }
  }

  return { ok: true, provided: true, value: normalized };
}

export async function getBottomNavigation(
  db: D1Database,
): Promise<BottomNavigationItem[]> {
  const rows = (
    await db
      .prepare(
        `SELECT item_key, label, icon_type, icon_value, icon_asset_id, is_enabled, sort_order
         FROM site_bottom_navigation
         ORDER BY sort_order ASC, item_key ASC`,
      )
      .all<BottomNavigationRow>()
  ).results;

  const byKey = new Map(rows.map((row) => [row.item_key, row]));
  return BOTTOM_NAVIGATION_KEYS.map((key, sortOrder) => {
    const row = byKey.get(key);
    if (!row) throw new Error('BOTTOM_NAVIGATION_MISSING');
    return {
      key,
      label: row.label,
      iconType: row.icon_type,
      iconValue: row.icon_value,
      iconAssetId: row.icon_asset_id,
      enabled: row.is_enabled === 1,
      sortOrder,
    };
  });
}

export async function getReadyBottomNavigationAssets(
  db: D1Database,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const placeholders = unique.map(() => '?').join(', ');
  const rows = (
    await db
      .prepare(
        `SELECT id, object_key
         FROM media_assets
         WHERE id IN (${placeholders})
           AND status = 'ready'
           AND deleted_at IS NULL
           AND media_kind IN ('image', 'animated_image')`,
      )
      .bind(...unique)
      .all<ReadyNavigationAssetRow>()
  ).results;
  return new Map(rows.map((row) => [row.id, row.object_key]));
}

export function createReplaceBottomNavigationStatements(
  db: D1Database,
  items: BottomNavigationInput,
  updatedAt: string,
): D1PreparedStatement[] {
  const byKey = new Map(items.map((item) => [item.key, item]));
  return BOTTOM_NAVIGATION_KEYS.map((key, sortOrder) => {
    const item = byKey.get(key);
    if (!item) throw new Error('BOTTOM_NAVIGATION_MISSING');
    return db
      .prepare(
        `INSERT INTO site_bottom_navigation (
           item_key, label, icon_type, icon_value, icon_asset_id, is_enabled, sort_order, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(item_key) DO UPDATE SET
           label = excluded.label,
           icon_type = excluded.icon_type,
           icon_value = excluded.icon_value,
           icon_asset_id = excluded.icon_asset_id,
           is_enabled = excluded.is_enabled,
           sort_order = excluded.sort_order,
           updated_at = excluded.updated_at`,
      )
      .bind(
        key,
        item.label,
        item.iconType,
        item.iconValue,
        item.iconAssetId,
        item.enabled ? 1 : 0,
        sortOrder,
        updatedAt,
      );
  });
}
