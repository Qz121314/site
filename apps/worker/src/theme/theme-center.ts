export type OfficialThemeKey = 'marketplace' | 'noir' | 'live' | 'saas' | 'travel' | 'tech';
export type ThemeKey = OfficialThemeKey | 'custom';
export type ThemeColorScheme = 'light' | 'dark';

export type ThemeTokens = {
  brand: string;
  brandStrong: string;
  text: string;
  muted: string;
  surface: string;
  surfaceSoft: string;
  line: string;
  pageBg: string;
  heroStart: string;
  heroEnd: string;
  heroGlow: string;
  shadow: string;
};

export type ThemePreset = {
  key: ThemeKey;
  label: string;
  description: string;
  colorScheme: ThemeColorScheme;
  density: 'compact' | 'standard' | 'comfortable';
  productMediaRatio: '1:1';
  tokens: ThemeTokens;
};

export type ImportedThemeDefinition = {
  source: 'shadcn' | 'json';
  sourceUrl?: string;
  label: string;
  description: string;
  colorScheme: ThemeColorScheme;
  tokens: ThemeTokens;
};

export type ThemeOverrides = {
  accent?: string;
  imported?: ImportedThemeDefinition;
};

export type ThemeSettings = {
  key: ThemeKey;
  overrides: ThemeOverrides;
};

export type ResolvedTheme = ThemePreset & {
  tokens: ThemeTokens;
  overrides: ThemeOverrides;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_COLOR_FUNCTION = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9a-z.%+\-/,\s]+\)$/iu;
const SAFE_HEX_COLOR = /^#[0-9a-f]{3,8}$/iu;
const TOKEN_KEYS: Array<keyof ThemeTokens> = [
  'brand',
  'brandStrong',
  'text',
  'muted',
  'surface',
  'surfaceSoft',
  'line',
  'pageBg',
  'heroStart',
  'heroEnd',
  'heroGlow',
  'shadow',
];

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    key: 'marketplace',
    label: '默认 · Marketplace',
    description: '通用业务目录与本地服务，明亮、紧凑、强调快速浏览。',
    colorScheme: 'light',
    density: 'standard',
    productMediaRatio: '1:1',
    tokens: {
      brand: '#ff5a1f',
      brandStrong: '#e94a12',
      text: '#1f2328',
      muted: '#6f7782',
      surface: '#ffffff',
      surfaceSoft: '#f8f8f9',
      line: '#e7e9ec',
      pageBg: '#f5f6f7',
      heroStart: '#ff6a2f',
      heroEnd: '#f24b18',
      heroGlow: '#ffd6c8',
      shadow: '0 12px 32px rgb(31 35 40 / 8%)',
    },
  },
  {
    key: 'noir',
    label: 'Noir · 成人内容',
    description: '深色、低亮背景与玫紫强调，适合成人内容、会员与私域展示。',
    colorScheme: 'dark',
    density: 'comfortable',
    productMediaRatio: '1:1',
    tokens: {
      brand: '#e85d9e',
      brandStrong: '#ff78b5',
      text: '#f8edf3',
      muted: '#ad98a4',
      surface: '#171116',
      surfaceSoft: '#211820',
      line: '#382934',
      pageBg: '#0d090c',
      heroStart: '#3b172b',
      heroEnd: '#171018',
      heroGlow: '#7a234e',
      shadow: '0 16px 40px rgb(0 0 0 / 34%)',
    },
  },
  {
    key: 'live',
    label: 'Live · 直播娱乐',
    description: '深色娱乐氛围、强状态色和高对比 CTA，适合主播与直播入口。',
    colorScheme: 'dark',
    density: 'standard',
    productMediaRatio: '1:1',
    tokens: {
      brand: '#ff355d',
      brandStrong: '#ff5f80',
      text: '#f8f9ff',
      muted: '#9ba2b4',
      surface: '#141722',
      surfaceSoft: '#1d2230',
      line: '#2f3547',
      pageBg: '#0a0c12',
      heroStart: '#5b1730',
      heroEnd: '#171629',
      heroGlow: '#ff355d',
      shadow: '0 16px 42px rgb(0 0 0 / 36%)',
    },
  },
  {
    key: 'saas',
    label: 'SaaS · 软件服务',
    description: '克制的蓝色体系、清晰层级与留白，适合软件、工具和企业服务。',
    colorScheme: 'light',
    density: 'comfortable',
    productMediaRatio: '1:1',
    tokens: {
      brand: '#4f46e5',
      brandStrong: '#3730a3',
      text: '#111827',
      muted: '#6b7280',
      surface: '#ffffff',
      surfaceSoft: '#f7f8fc',
      line: '#e5e7eb',
      pageBg: '#f8fafc',
      heroStart: '#4f46e5',
      heroEnd: '#2563eb',
      heroGlow: '#bfdbfe',
      shadow: '0 14px 34px rgb(79 70 229 / 10%)',
    },
  },
  {
    key: 'travel',
    label: 'Travel · 文旅目的地',
    description: '自然暖色、摄影友好和柔和层次，适合景区、旅行与本地体验。',
    colorScheme: 'light',
    density: 'comfortable',
    productMediaRatio: '1:1',
    tokens: {
      brand: '#df6c4f',
      brandStrong: '#b84d35',
      text: '#27312e',
      muted: '#68766f',
      surface: '#fffdf8',
      surfaceSoft: '#f5f1e7',
      line: '#e7dfd1',
      pageBg: '#f4f1e9',
      heroStart: '#35756a',
      heroEnd: '#7a9b75',
      heroGlow: '#f0c996',
      shadow: '0 14px 34px rgb(57 72 65 / 12%)',
    },
  },
  {
    key: 'tech',
    label: 'Tech · 科技未来',
    description: '深蓝黑底、青色高亮与玻璃质感，适合科技、硬件和创新产品。',
    colorScheme: 'dark',
    density: 'standard',
    productMediaRatio: '1:1',
    tokens: {
      brand: '#22d3ee',
      brandStrong: '#67e8f9',
      text: '#e7f7fb',
      muted: '#88a8b1',
      surface: '#0f1a20',
      surfaceSoft: '#14242c',
      line: '#23414b',
      pageBg: '#071015',
      heroStart: '#0b4452',
      heroEnd: '#10263f',
      heroGlow: '#22d3ee',
      shadow: '0 16px 44px rgb(0 0 0 / 38%)',
    },
  },
] as const;

const presetByKey = new Map(THEME_PRESETS.map((preset) => [preset.key, preset]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripControlCharacters(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('');
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = stripControlCharacters(value).replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, maxLength) : null;
}

function safeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (!color || color.length > 120) return null;
  if (SAFE_HEX_COLOR.test(color) || SAFE_COLOR_FUNCTION.test(color) || /^(?:transparent|black|white)$/iu.test(color)) {
    return color;
  }
  return null;
}

function safeShadow(value: unknown, colorScheme: ThemeColorScheme): string {
  if (typeof value === 'string' && value.length <= 120 && /^0\s+\d+px\s+\d+px\s+rgb\([0-9\s/%.-]+\)$/iu.test(value.trim())) {
    return value.trim();
  }
  return colorScheme === 'dark'
    ? '0 16px 44px rgb(0 0 0 / 36%)'
    : '0 12px 32px rgb(31 35 40 / 8%)';
}

function normalizeThemeTokens(value: unknown, colorScheme: ThemeColorScheme): ThemeTokens | null {
  if (!isRecord(value)) return null;
  const colors = TOKEN_KEYS.filter((key) => key !== 'shadow');
  const normalized = {} as ThemeTokens;
  for (const key of colors) {
    const color = safeColor(value[key]);
    if (!color) return null;
    normalized[key] = color;
  }
  normalized.shadow = safeShadow(value.shadow, colorScheme);
  return normalized;
}

export function normalizeImportedThemeDefinition(value: unknown): ImportedThemeDefinition | null {
  if (!isRecord(value)) return null;
  const source = value.source === 'shadcn' || value.source === 'json' ? value.source : null;
  const label = cleanText(value.label, 80);
  const description = cleanText(value.description, 220) ?? 'Imported theme.';
  const colorScheme = value.colorScheme === 'light' || value.colorScheme === 'dark' ? value.colorScheme : null;
  if (!source || !label || !colorScheme) return null;
  const tokens = normalizeThemeTokens(value.tokens, colorScheme);
  if (!tokens) return null;
  const sourceUrl = cleanText(value.sourceUrl, 1200);
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== 'https:') return null;
    } catch {
      return null;
    }
  }
  return {
    source,
    ...(sourceUrl ? { sourceUrl } : {}),
    label,
    description,
    colorScheme,
    tokens,
  };
}

export function isThemeKey(value: unknown): value is ThemeKey {
  return value === 'custom' || (typeof value === 'string' && presetByKey.has(value as OfficialThemeKey));
}

export function normalizeThemeOverrides(value: unknown): ThemeOverrides {
  if (!isRecord(value)) return {};
  const accent = typeof value.accent === 'string' ? value.accent.trim().toLowerCase() : '';
  const imported = normalizeImportedThemeDefinition(value.imported);
  return {
    ...(HEX_COLOR.test(accent) ? { accent } : {}),
    ...(imported ? { imported } : {}),
  };
}

export function parseThemeSettings(themeKey: unknown, overridesJson: unknown): ThemeSettings {
  const requestedKey = isThemeKey(themeKey) ? themeKey : 'marketplace';
  let overrides: ThemeOverrides = {};
  if (typeof overridesJson === 'string' && overridesJson) {
    try {
      overrides = normalizeThemeOverrides(JSON.parse(overridesJson) as unknown);
    } catch {
      overrides = {};
    }
  }
  if (overrides.imported) {
    return { key: 'custom', overrides };
  }
  return { key: requestedKey === 'custom' ? 'marketplace' : requestedKey, overrides };
}

function applyAccent(tokens: ThemeTokens, accent: string | undefined): ThemeTokens {
  return accent ? { ...tokens, brand: accent, brandStrong: accent } : tokens;
}

export function resolveTheme(settings: ThemeSettings): ResolvedTheme {
  const accent = settings.overrides.accent;
  if (settings.key === 'custom' && settings.overrides.imported) {
    const imported = settings.overrides.imported;
    return {
      key: 'custom',
      label: imported.label,
      description: imported.description,
      colorScheme: imported.colorScheme,
      density: 'standard',
      productMediaRatio: '1:1',
      tokens: applyAccent(imported.tokens, accent),
      overrides: settings.overrides,
    };
  }
  const preset = presetByKey.get(settings.key as OfficialThemeKey) ?? THEME_PRESETS[0]!;
  return {
    ...preset,
    overrides: settings.overrides,
    tokens: applyAccent(preset.tokens, accent),
  };
}

export function validateThemeUpdate(value: unknown):
  | { ok: true; settings: ThemeSettings }
  | { ok: false; field: string; message: string } {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '主题设置数据无效。' };
  }
  if (!isThemeKey(value.themeKey)) {
    return { ok: false, field: 'themeKey', message: '请选择有效的主题预设。' };
  }
  const overrides = normalizeThemeOverrides(value.overrides);
  if (isRecord(value.overrides) && typeof value.overrides.accent === 'string') {
    const accent = value.overrides.accent.trim();
    if (accent && !HEX_COLOR.test(accent)) {
      return { ok: false, field: 'accent', message: '品牌强调色必须是 6 位十六进制颜色。' };
    }
  }
  if (value.themeKey === 'custom' && !overrides.imported) {
    return { ok: false, field: 'imported', message: '请先从主题库或 JSON 导入一个有效主题。' };
  }
  return { ok: true, settings: { key: value.themeKey, overrides } };
}

export function persistedThemeKey(settings: ThemeSettings): OfficialThemeKey {
  return settings.key === 'custom' ? 'marketplace' : settings.key;
}

export async function getThemeSettings(db: D1Database): Promise<ThemeSettings> {
  const row = await db
    .prepare('SELECT theme_key, theme_overrides_json FROM site_settings WHERE id = 1')
    .first<{ theme_key: string | null; theme_overrides_json: string | null }>();
  if (!row) throw new Error('SITE_SETTINGS_MISSING');
  return parseThemeSettings(row.theme_key, row.theme_overrides_json);
}

export function createUpdateThemeStatement(
  db: D1Database,
  settings: ThemeSettings,
  updatedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE site_settings
       SET theme_key = ?, theme_overrides_json = ?, updated_at = ?
       WHERE id = 1`,
    )
    .bind(persistedThemeKey(settings), JSON.stringify(settings.overrides), updatedAt);
}
