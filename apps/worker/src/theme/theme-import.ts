import {
  normalizeImportedThemeDefinition,
  type ImportedThemeDefinition,
  type ThemeColorScheme,
  type ThemeTokens,
} from './theme-center';

const MAX_REMOTE_THEME_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const THEME_ITEM_TYPES = new Set(['registry:theme']);

const LIGHT_FALLBACK: ThemeTokens = {
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
};

const DARK_FALLBACK: ThemeTokens = {
  brand: '#22d3ee',
  brandStrong: '#67e8f9',
  text: '#eef7fa',
  muted: '#94a3b8',
  surface: '#111827',
  surfaceSoft: '#182232',
  line: '#2f3a4b',
  pageBg: '#090f17',
  heroStart: '#123b4b',
  heroEnd: '#17233f',
  heroGlow: '#22d3ee',
  shadow: '0 16px 44px rgb(0 0 0 / 36%)',
};

type ImportResult =
  | { ok: true; definition: ImportedThemeDefinition }
  | { ok: false; code: string; message: string; field: 'url' | 'json' | 'mode' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, maxLength) : fallback;
}

function normalizeCssColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (!color || color.length > 120) return null;
  if (/^(?:#[0-9a-f]{3,8})$/iu.test(color)) return color;
  if (/^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9a-z.%+\-/,\s]+\)$/iu.test(color)) return color;
  if (/^(?:transparent|black|white)$/iu.test(color)) return color;
  if (/^-?\d+(?:\.\d+)?(?:deg)?\s+-?\d+(?:\.\d+)?%\s+-?\d+(?:\.\d+)?%(?:\s*\/\s*\d+(?:\.\d+)?%?)?$/u.test(color)) {
    return `hsl(${color})`;
  }
  return null;
}

function readColor(record: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = normalizeCssColor(record[key]);
    if (value) return value;
  }
  return fallback;
}

function normalizeMode(value: unknown): ThemeColorScheme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

function mapShadcnCssVars(
  vars: Record<string, unknown>,
  colorScheme: ThemeColorScheme,
): ThemeTokens {
  const fallback = colorScheme === 'dark' ? DARK_FALLBACK : LIGHT_FALLBACK;
  const brand = readColor(vars, ['primary', 'accent', 'ring'], fallback.brand);
  const brandStrong = readColor(vars, ['ring', 'primary', 'accent'], fallback.brandStrong);
  const text = readColor(vars, ['foreground', 'card-foreground'], fallback.text);
  const muted = readColor(vars, ['muted-foreground', 'secondary-foreground'], fallback.muted);
  const surface = readColor(vars, ['card', 'popover', 'background'], fallback.surface);
  const surfaceSoft = readColor(vars, ['muted', 'secondary', 'card'], fallback.surfaceSoft);
  const line = readColor(vars, ['border', 'input', 'muted'], fallback.line);
  const pageBg = readColor(vars, ['background'], fallback.pageBg);
  const heroStart = brand;
  const heroEnd = readColor(vars, ['accent', 'secondary', 'primary'], fallback.heroEnd);
  const heroGlow = readColor(vars, ['ring', 'primary', 'accent'], fallback.heroGlow);
  return {
    brand,
    brandStrong,
    text,
    muted,
    surface,
    surfaceSoft,
    line,
    pageBg,
    heroStart,
    heroEnd,
    heroGlow,
    shadow: fallback.shadow,
  };
}

function parseShadcnTheme(
  value: unknown,
  colorScheme: ThemeColorScheme,
  source: 'shadcn' | 'json',
  sourceUrl?: string,
): ImportResult {
  if (!isRecord(value) || !THEME_ITEM_TYPES.has(String(value.type ?? ''))) {
    return {
      ok: false,
      code: 'THEME_IMPORT_TYPE_INVALID',
      field: source === 'shadcn' ? 'url' : 'json',
      message: '只支持 shadcn registry:theme 主题项。',
    };
  }
  const cssVars = isRecord(value.cssVars) ? value.cssVars : null;
  const modeVars = cssVars && isRecord(cssVars[colorScheme]) ? cssVars[colorScheme] : null;
  if (!modeVars) {
    return {
      ok: false,
      code: 'THEME_IMPORT_MODE_MISSING',
      field: 'mode',
      message: `该主题没有 ${colorScheme === 'dark' ? 'dark' : 'light'} 模式的 cssVars。`,
    };
  }

  const rawDefinition = {
    source,
    ...(sourceUrl ? { sourceUrl } : {}),
    label: cleanText(value.title ?? value.name, 'Imported theme', 80),
    description: cleanText(value.description, 'Imported from shadcn Registry.', 220),
    colorScheme,
    tokens: mapShadcnCssVars(modeVars, colorScheme),
  };
  const definition = normalizeImportedThemeDefinition(rawDefinition);
  if (!definition) {
    return {
      ok: false,
      code: 'THEME_IMPORT_TOKENS_INVALID',
      field: source === 'shadcn' ? 'url' : 'json',
      message: '主题颜色 Token 无法安全转换。',
    };
  }
  return { ok: true, definition };
}

function parsePortableTheme(value: unknown, mode: ThemeColorScheme): ImportResult {
  if (!isRecord(value) || !isRecord(value.tokens)) {
    return {
      ok: false,
      code: 'THEME_IMPORT_JSON_INVALID',
      field: 'json',
      message: 'JSON 不是受支持的主题格式。',
    };
  }
  const rawDefinition = {
    source: 'json',
    label: cleanText(value.label ?? value.name, 'Custom theme', 80),
    description: cleanText(value.description, 'Imported custom theme.', 220),
    colorScheme: normalizeMode(value.colorScheme) ?? mode,
    tokens: value.tokens,
  };
  const definition = normalizeImportedThemeDefinition(rawDefinition);
  if (!definition) {
    return {
      ok: false,
      code: 'THEME_IMPORT_TOKENS_INVALID',
      field: 'json',
      message: '自定义主题必须提供完整且安全的 Theme Tokens。',
    };
  }
  return { ok: true, definition };
}

export function importThemeJson(value: unknown, mode: unknown): ImportResult {
  const colorScheme = normalizeMode(mode);
  if (!colorScheme) {
    return { ok: false, code: 'THEME_IMPORT_MODE_INVALID', field: 'mode', message: '请选择浅色或深色模式。' };
  }
  if (isRecord(value) && value.type === 'registry:theme') {
    return parseShadcnTheme(value, colorScheme, 'json');
  }
  return parsePortableTheme(value, colorScheme);
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function validateRemoteUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 1200) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    isPrivateIpv4(host)
  ) {
    return null;
  }
  return url;
}

async function fetchThemeJson(url: URL): Promise<{ ok: true; value: unknown; finalUrl: string } | { ok: false; code: string; message: string }> {
  let current = url;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'application/json, text/plain;q=0.8',
        'user-agent': 'site-theme-importer/1.0',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === MAX_REDIRECTS) {
        return { ok: false, code: 'THEME_IMPORT_REDIRECT_INVALID', message: '主题地址重定向无效或次数过多。' };
      }
      const next = validateRemoteUrl(new URL(location, current).toString());
      if (!next) return { ok: false, code: 'THEME_IMPORT_URL_BLOCKED', message: '重定向目标不是允许的公开 HTTPS 地址。' };
      current = next;
      continue;
    }
    if (!response.ok) {
      return { ok: false, code: 'THEME_IMPORT_FETCH_FAILED', message: `主题源返回 HTTP ${response.status}。` };
    }
    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REMOTE_THEME_BYTES) {
      return { ok: false, code: 'THEME_IMPORT_TOO_LARGE', message: '主题 JSON 不能超过 256 KB。' };
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REMOTE_THEME_BYTES) {
      return { ok: false, code: 'THEME_IMPORT_TOO_LARGE', message: '主题 JSON 不能超过 256 KB。' };
    }
    try {
      return { ok: true, value: JSON.parse(text) as unknown, finalUrl: current.toString() };
    } catch {
      return { ok: false, code: 'THEME_IMPORT_JSON_INVALID', message: '主题地址返回的不是有效 JSON。' };
    }
  }
  return { ok: false, code: 'THEME_IMPORT_FETCH_FAILED', message: '主题读取失败。' };
}

export async function importThemeFromUrl(urlValue: unknown, mode: unknown): Promise<ImportResult> {
  const colorScheme = normalizeMode(mode);
  if (!colorScheme) {
    return { ok: false, code: 'THEME_IMPORT_MODE_INVALID', field: 'mode', message: '请选择浅色或深色模式。' };
  }
  const url = validateRemoteUrl(urlValue);
  if (!url) {
    return { ok: false, code: 'THEME_IMPORT_URL_INVALID', field: 'url', message: '请输入公开可访问的 HTTPS shadcn Registry Theme 地址。' };
  }
  const fetched = await fetchThemeJson(url);
  if (!fetched.ok) return { ok: false, code: fetched.code, field: 'url', message: fetched.message };
  return parseShadcnTheme(fetched.value, colorScheme, 'shadcn', fetched.finalUrl);
}
