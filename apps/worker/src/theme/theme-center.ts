export type OfficialThemeKey =
  'marketplace' | 'noir' | 'live' | 'saas' | 'travel' | 'tech';
export type ThemeKey = OfficialThemeKey | 'custom';
export type ThemeColorScheme = 'light' | 'dark';
export type ThemeFontPack = 'modern' | 'editorial' | 'compact' | 'technical';
export type ThemeButtonStyle = 'refined' | 'minimal' | 'soft-pill';
export type ThemeMediaStyle = 'precise' | 'soft' | 'editorial';
export type ThemeMotionStyle = 'restrained' | 'gentle' | 'active';
export type ThemeNavigationStyle = 'quiet' | 'tinted' | 'solid';
export type ThemeDensity = 'compact' | 'standard' | 'comfortable';

export type ThemeInstallPrompt = {
  enabled: boolean;
  delaySeconds: number;
  title: string;
  description: string;
  iosDescription: string;
  installLabel: string;
  dismissLabel: string;
};

export type ThemeRecipe = {
  version: 2;
  fontPack: ThemeFontPack;
  buttonStyle: ThemeButtonStyle;
  mediaStyle: ThemeMediaStyle;
  motionStyle: ThemeMotionStyle;
  navigationStyle: ThemeNavigationStyle;
};

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
  density: ThemeDensity;
  productMediaRatio: '1:1';
  recipe: ThemeRecipe;
  installPrompt: ThemeInstallPrompt;
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
  density?: ThemeDensity;
  fontPack?: ThemeFontPack;
  buttonStyle?: ThemeButtonStyle;
  mediaStyle?: ThemeMediaStyle;
  motionStyle?: ThemeMotionStyle;
  navigationStyle?: ThemeNavigationStyle;
  installPrompt?: ThemeInstallPrompt;
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
const SAFE_COLOR_FUNCTION =
  /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9a-z.%+\-/,\s]+\)$/iu;
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

const DEFAULT_RECIPE: ThemeRecipe = {
  version: 2,
  fontPack: 'modern',
  buttonStyle: 'refined',
  mediaStyle: 'soft',
  motionStyle: 'restrained',
  navigationStyle: 'quiet',
};

export const DEFAULT_INSTALL_PROMPT: ThemeInstallPrompt = {
  enabled: true,
  delaySeconds: 30,
  title: 'Install app',
  description: 'Add it to your desktop for faster access.',
  iosDescription: 'Use Share, then Add to Home Screen.',
  installLabel: 'Install',
  dismissLabel: 'Not now',
};

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    key: 'marketplace',
    label: '默认 · Marketplace',
    description: '通用业务目录与本地服务，明亮、紧凑、强调快速浏览。',
    colorScheme: 'light',
    density: 'standard',
    productMediaRatio: '1:1',
    recipe: {
      ...DEFAULT_RECIPE,
      fontPack: 'compact',
      mediaStyle: 'precise',
      navigationStyle: 'tinted',
    },
    installPrompt: DEFAULT_INSTALL_PROMPT,
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
    label: 'Premium Noir Dating V3',
    description: '暖黑、柔白与灰粉玫瑰色，以低层级材质和电影感素材呈现高级约会氛围。',
    colorScheme: 'dark',
    density: 'standard',
    productMediaRatio: '1:1',
    recipe: {
      version: 2,
      fontPack: 'editorial',
      buttonStyle: 'refined',
      mediaStyle: 'soft',
      motionStyle: 'restrained',
      navigationStyle: 'quiet',
    },
    installPrompt: DEFAULT_INSTALL_PROMPT,
    tokens: {
      brand: '#df5d87',
      brandStrong: '#f08bab',
      text: '#f6f0f3',
      muted: '#aa9da4',
      surface: '#141013',
      surfaceSoft: '#1c161a',
      line: '#30262c',
      pageBg: '#0c090b',
      heroStart: '#351420',
      heroEnd: '#110d10',
      heroGlow: '#7b2446',
      shadow: '0 18px 48px rgb(0 0 0 / 28%)',
    },
  },
  {
    key: 'live',
    label: 'Live · 直播娱乐',
    description: '深色私密氛围、克制状态色和高对比 CTA，适合直播与夜间社交入口。',
    colorScheme: 'dark',
    density: 'standard',
    productMediaRatio: '1:1',
    recipe: {
      version: 2,
      fontPack: 'editorial',
      buttonStyle: 'refined',
      mediaStyle: 'editorial',
      motionStyle: 'restrained',
      navigationStyle: 'quiet',
    },
    installPrompt: DEFAULT_INSTALL_PROMPT,
    tokens: {
      brand: '#e3486d',
      brandStrong: '#f1728d',
      text: '#f7f1f4',
      muted: '#aa9ca4',
      surface: '#151014',
      surfaceSoft: '#1e171c',
      line: '#33272e',
      pageBg: '#0b080a',
      heroStart: '#481526',
      heroEnd: '#160f14',
      heroGlow: '#96264a',
      shadow: '0 18px 48px rgb(0 0 0 / 30%)',
    },
  },
  {
    key: 'saas',
    label: 'SaaS · 软件服务',
    description: '克制的蓝色体系、清晰层级与留白，适合软件、工具和企业服务。',
    colorScheme: 'light',
    density: 'comfortable',
    productMediaRatio: '1:1',
    recipe: {
      ...DEFAULT_RECIPE,
      fontPack: 'modern',
      mediaStyle: 'precise',
      navigationStyle: 'tinted',
    },
    installPrompt: DEFAULT_INSTALL_PROMPT,
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
    recipe: {
      version: 2,
      fontPack: 'editorial',
      buttonStyle: 'refined',
      mediaStyle: 'editorial',
      motionStyle: 'gentle',
      navigationStyle: 'quiet',
    },
    installPrompt: DEFAULT_INSTALL_PROMPT,
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
    recipe: {
      version: 2,
      fontPack: 'technical',
      buttonStyle: 'minimal',
      mediaStyle: 'precise',
      motionStyle: 'active',
      navigationStyle: 'tinted',
    },
    installPrompt: DEFAULT_INSTALL_PROMPT,
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
  if (
    SAFE_HEX_COLOR.test(color) ||
    SAFE_COLOR_FUNCTION.test(color) ||
    /^(?:transparent|black|white)$/iu.test(color)
  ) {
    return color;
  }
  return null;
}

function normalizeOption<const T extends readonly string[]>(
  value: unknown,
  options: T,
): T[number] | null {
  return typeof value === 'string' && options.includes(value) ? value : null;
}

function safeShadow(value: unknown, colorScheme: ThemeColorScheme): string {
  if (
    typeof value === 'string' &&
    value.length <= 120 &&
    /^0\s+\d+px\s+\d+px\s+rgb\([0-9\s/%.-]+\)$/iu.test(value.trim())
  ) {
    return value.trim();
  }
  return colorScheme === 'dark'
    ? '0 16px 44px rgb(0 0 0 / 36%)'
    : '0 12px 32px rgb(31 35 40 / 8%)';
}

function normalizeThemeTokens(
  value: unknown,
  colorScheme: ThemeColorScheme,
): ThemeTokens | null {
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

export function normalizeImportedThemeDefinition(
  value: unknown,
): ImportedThemeDefinition | null {
  if (!isRecord(value)) return null;
  const source =
    value.source === 'shadcn' || value.source === 'json' ? value.source : null;
  const label = cleanText(value.label, 80);
  const description = cleanText(value.description, 220) ?? 'Imported theme.';
  const colorScheme =
    value.colorScheme === 'light' || value.colorScheme === 'dark'
      ? value.colorScheme
      : null;
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
  return (
    value === 'custom' ||
    (typeof value === 'string' && presetByKey.has(value as OfficialThemeKey))
  );
}

export function normalizeInstallPrompt(value: unknown): ThemeInstallPrompt | null {
  if (!isRecord(value)) return null;
  const delay = Number(value.delaySeconds);
  return {
    enabled:
      typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_INSTALL_PROMPT.enabled,
    delaySeconds:
      Number.isInteger(delay) && delay >= 5 && delay <= 120
        ? delay
        : DEFAULT_INSTALL_PROMPT.delaySeconds,
    title: cleanText(value.title, 80) ?? DEFAULT_INSTALL_PROMPT.title,
    description: cleanText(value.description, 160) ?? DEFAULT_INSTALL_PROMPT.description,
    iosDescription:
      cleanText(value.iosDescription, 160) ?? DEFAULT_INSTALL_PROMPT.iosDescription,
    installLabel:
      cleanText(value.installLabel, 32) ?? DEFAULT_INSTALL_PROMPT.installLabel,
    dismissLabel:
      cleanText(value.dismissLabel, 32) ?? DEFAULT_INSTALL_PROMPT.dismissLabel,
  };
}

export function normalizeThemeOverrides(value: unknown): ThemeOverrides {
  if (!isRecord(value)) return {};
  const accent =
    typeof value.accent === 'string' ? value.accent.trim().toLowerCase() : '';
  const imported = normalizeImportedThemeDefinition(value.imported);
  const density = normalizeOption(value.density, [
    'compact',
    'standard',
    'comfortable',
  ] as const);
  const fontPack = normalizeOption(value.fontPack, [
    'modern',
    'editorial',
    'compact',
    'technical',
  ] as const);
  const buttonStyle = normalizeOption(value.buttonStyle, [
    'refined',
    'minimal',
    'soft-pill',
  ] as const);
  const mediaStyle = normalizeOption(value.mediaStyle, [
    'precise',
    'soft',
    'editorial',
  ] as const);
  const motionStyle = normalizeOption(value.motionStyle, [
    'restrained',
    'gentle',
    'active',
  ] as const);
  const navigationStyle = normalizeOption(value.navigationStyle, [
    'quiet',
    'tinted',
    'solid',
  ] as const);
  const installPrompt = normalizeInstallPrompt(value.installPrompt);
  return {
    ...(HEX_COLOR.test(accent) ? { accent } : {}),
    ...(density ? { density } : {}),
    ...(fontPack ? { fontPack } : {}),
    ...(buttonStyle ? { buttonStyle } : {}),
    ...(mediaStyle ? { mediaStyle } : {}),
    ...(motionStyle ? { motionStyle } : {}),
    ...(navigationStyle ? { navigationStyle } : {}),
    ...(installPrompt ? { installPrompt } : {}),
    ...(imported ? { imported } : {}),
  };
}

export function parseThemeSettings(
  themeKey: unknown,
  overridesJson: unknown,
): ThemeSettings {
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
    const recipe: ThemeRecipe = {
      ...DEFAULT_RECIPE,
      fontPack: settings.overrides.fontPack ?? DEFAULT_RECIPE.fontPack,
      buttonStyle: settings.overrides.buttonStyle ?? DEFAULT_RECIPE.buttonStyle,
      mediaStyle: settings.overrides.mediaStyle ?? DEFAULT_RECIPE.mediaStyle,
      motionStyle: settings.overrides.motionStyle ?? DEFAULT_RECIPE.motionStyle,
      navigationStyle:
        settings.overrides.navigationStyle ?? DEFAULT_RECIPE.navigationStyle,
    };
    return {
      key: 'custom',
      label: imported.label,
      description: imported.description,
      colorScheme: imported.colorScheme,
      density: settings.overrides.density ?? 'standard',
      productMediaRatio: '1:1',
      recipe,
      installPrompt: settings.overrides.installPrompt ?? DEFAULT_INSTALL_PROMPT,
      tokens: applyAccent(imported.tokens, accent),
      overrides: settings.overrides,
    };
  }
  const preset = presetByKey.get(settings.key as OfficialThemeKey) ?? THEME_PRESETS[0]!;
  return {
    ...preset,
    density: settings.overrides.density ?? preset.density,
    recipe: {
      ...preset.recipe,
      fontPack: settings.overrides.fontPack ?? preset.recipe.fontPack,
      buttonStyle: settings.overrides.buttonStyle ?? preset.recipe.buttonStyle,
      mediaStyle: settings.overrides.mediaStyle ?? preset.recipe.mediaStyle,
      motionStyle: settings.overrides.motionStyle ?? preset.recipe.motionStyle,
      navigationStyle:
        settings.overrides.navigationStyle ?? preset.recipe.navigationStyle,
    },
    installPrompt: settings.overrides.installPrompt ?? preset.installPrompt,
    overrides: settings.overrides,
    tokens: applyAccent(preset.tokens, accent),
  };
}

export function validateThemeUpdate(
  value: unknown,
): { ok: true; settings: ThemeSettings } | { ok: false; field: string; message: string } {
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
      return {
        ok: false,
        field: 'accent',
        message: '品牌强调色必须是 6 位十六进制颜色。',
      };
    }
  }
  if (value.themeKey === 'custom' && !overrides.imported) {
    return {
      ok: false,
      field: 'imported',
      message: '请先从主题库或 JSON 导入一个有效主题。',
    };
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
