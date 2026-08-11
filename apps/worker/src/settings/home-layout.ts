export type HomeLayout = {
  shortcutSectionIds: string[];
  recommendationSectionIds: string[];
};

export type HomeLayoutInput = HomeLayout;

type HomeSectionSlotRow = {
  placement: 'shortcut' | 'recommendation';
  section_id: string;
  sort_order: number;
};

type ValidationResult =
  | { ok: true; provided: false; value: null }
  | { ok: true; provided: true; value: HomeLayoutInput }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeIds(
  value: unknown,
  field: string,
  max: number,
): { ok: true; value: string[] } | { ok: false; field: string; message: string } {
  if (!Array.isArray(value)) {
    return { ok: false, field, message: '首页分区配置必须是数组。' };
  }
  if (value.length > max) {
    return { ok: false, field, message: `首页该区域最多选择 ${max} 个分区。` };
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== 'string') {
      return { ok: false, field: `${field}.${index}`, message: '首页分区标识无效。' };
    }
    const id = item.trim();
    if (!id || id.length > 120 || seen.has(id)) {
      return {
        ok: false,
        field: `${field}.${index}`,
        message: '首页分区标识无效或重复。',
      };
    }
    seen.add(id);
    normalized.push(id);
  }
  return { ok: true, value: normalized };
}

export function validateHomeLayoutInput(value: unknown): ValidationResult {
  if (value === undefined) return { ok: true, provided: false, value: null };
  if (!isRecord(value)) {
    return { ok: false, field: 'homeLayout', message: '首页布局配置无效。' };
  }

  const shortcuts = normalizeIds(
    value.shortcutSectionIds,
    'homeLayout.shortcutSectionIds',
    7,
  );
  if (!shortcuts.ok) return shortcuts;
  const recommendations = normalizeIds(
    value.recommendationSectionIds,
    'homeLayout.recommendationSectionIds',
    3,
  );
  if (!recommendations.ok) return recommendations;

  return {
    ok: true,
    provided: true,
    value: {
      shortcutSectionIds: shortcuts.value,
      recommendationSectionIds: recommendations.value,
    },
  };
}

export async function getHomeLayout(db: D1Database): Promise<HomeLayout> {
  const rows = (
    await db
      .prepare(
        `SELECT placement, section_id, sort_order
         FROM site_home_section_slots
         ORDER BY placement ASC, sort_order ASC, section_id ASC`,
      )
      .all<HomeSectionSlotRow>()
  ).results;

  return {
    shortcutSectionIds: rows
      .filter((row) => row.placement === 'shortcut')
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((row) => row.section_id),
    recommendationSectionIds: rows
      .filter((row) => row.placement === 'recommendation')
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((row) => row.section_id),
  };
}

export async function getActiveHomeSectionIds(
  db: D1Database,
  ids: string[],
): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const placeholders = unique.map(() => '?').join(', ');
  const rows = (
    await db
      .prepare(
        `SELECT id
         FROM sections
         WHERE id IN (${placeholders})
           AND deleted_at IS NULL
           AND is_enabled = 1`,
      )
      .bind(...unique)
      .all<{ id: string }>()
  ).results;
  return new Set(rows.map((row) => row.id));
}

export function createReplaceHomeLayoutStatements(
  db: D1Database,
  input: HomeLayoutInput,
  updatedAt: string,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM site_home_section_slots'),
  ];
  input.shortcutSectionIds.forEach((sectionId, sortOrder) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO site_home_section_slots (placement, section_id, sort_order, updated_at)
           VALUES ('shortcut', ?, ?, ?)`,
        )
        .bind(sectionId, sortOrder, updatedAt),
    );
  });
  input.recommendationSectionIds.forEach((sectionId, sortOrder) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO site_home_section_slots (placement, section_id, sort_order, updated_at)
           VALUES ('recommendation', ?, ?, ?)`,
        )
        .bind(sectionId, sortOrder, updatedAt),
    );
  });
  return statements;
}
