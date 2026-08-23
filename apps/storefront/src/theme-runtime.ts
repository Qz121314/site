import { storefrontBrandForeground } from '@site/storefront-ui/theme';

type ThemeTokens = {
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

type ThemeDensity = 'compact' | 'standard' | 'comfortable';
type ThemeRecipe = {
  version: 2;
  fontPack: 'modern' | 'editorial' | 'compact' | 'technical';
  buttonStyle: 'refined' | 'minimal' | 'soft-pill';
  mediaStyle: 'precise' | 'soft' | 'editorial';
  motionStyle: 'restrained' | 'gentle' | 'active';
  navigationStyle: 'quiet' | 'tinted' | 'solid';
};

export type ThemeInstallPrompt = {
  enabled: boolean;
  delaySeconds: number;
  title: string;
  description: string;
  iosDescription: string;
  installLabel: string;
  dismissLabel: string;
};

export type PublicTheme = {
  key: string;
  colorScheme: 'light' | 'dark';
  density: ThemeDensity;
  productMediaRatio: '1:1';
  recipe: ThemeRecipe;
  installPrompt: ThemeInstallPrompt;
  tokens: ThemeTokens;
};

const CACHE_KEY = 'storefront-theme-v4';
const LEGACY_CACHE_KEYS = ['storefront-theme-v3', 'storefront-theme-v2'] as const;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isThemeDensity(value: unknown): value is ThemeDensity {
  return value === 'compact' || value === 'standard' || value === 'comfortable';
}

function validInstallPrompt(value: unknown): value is ThemeInstallPrompt {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    Number.isInteger(value.delaySeconds) &&
    Number(value.delaySeconds) >= 5 &&
    Number(value.delaySeconds) <= 120 &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.iosDescription === 'string' &&
    typeof value.installLabel === 'string' &&
    typeof value.dismissLabel === 'string'
  );
}

function validTheme(value: unknown): value is PublicTheme {
  if (!isRecord(value) || typeof value.key !== 'string') return false;
  if (value.colorScheme !== 'light' && value.colorScheme !== 'dark') return false;
  if (!isThemeDensity(value.density)) return false;
  if (value.productMediaRatio !== '1:1') return false;
  const recipe = value.recipe;
  if (!isRecord(recipe) || recipe.version !== 2) return false;
  if (!['modern', 'editorial', 'compact', 'technical'].includes(String(recipe.fontPack)))
    return false;
  if (!['refined', 'minimal', 'soft-pill'].includes(String(recipe.buttonStyle)))
    return false;
  if (!['precise', 'soft', 'editorial'].includes(String(recipe.mediaStyle))) return false;
  if (!['restrained', 'gentle', 'active'].includes(String(recipe.motionStyle)))
    return false;
  if (!['quiet', 'tinted', 'solid'].includes(String(recipe.navigationStyle)))
    return false;
  if (!validInstallPrompt(value.installPrompt)) return false;
  const tokens = value.tokens;
  if (!isRecord(tokens)) return false;
  return TOKEN_KEYS.every((key) => typeof tokens[key] === 'string');
}

function defaultRecipe(themeKey: string): ThemeRecipe {
  if (themeKey === 'noir') {
    return {
      version: 2,
      fontPack: 'editorial',
      buttonStyle: 'refined',
      mediaStyle: 'soft',
      motionStyle: 'restrained',
      navigationStyle: 'quiet',
    };
  }
  return {
    version: 2,
    fontPack: 'modern',
    buttonStyle: 'refined',
    mediaStyle: 'precise',
    motionStyle: 'restrained',
    navigationStyle: 'tinted',
  };
}

function upgradeLegacyTheme(value: unknown): PublicTheme | null {
  if (!isRecord(value) || typeof value.key !== 'string') return null;
  if (value.colorScheme !== 'light' && value.colorScheme !== 'dark') return null;
  if (!isThemeDensity(value.density) || value.productMediaRatio !== '1:1') return null;
  if (!isRecord(value.tokens)) return null;
  if (!validInstallPrompt(value.installPrompt)) return null;
  const tokens = value.tokens;
  if (!TOKEN_KEYS.every((key) => typeof tokens[key] === 'string')) return null;
  const recipe =
    isRecord(value.recipe) &&
    value.recipe.version === 2 &&
    ['modern', 'editorial', 'compact', 'technical'].includes(
      String(value.recipe.fontPack),
    ) &&
    ['refined', 'minimal', 'soft-pill'].includes(String(value.recipe.buttonStyle)) &&
    ['precise', 'soft', 'editorial'].includes(String(value.recipe.mediaStyle)) &&
    ['restrained', 'gentle', 'active'].includes(String(value.recipe.motionStyle)) &&
    ['quiet', 'tinted', 'solid'].includes(String(value.recipe.navigationStyle))
      ? (value.recipe as ThemeRecipe)
      : defaultRecipe(value.key);
  return {
    key: value.key,
    colorScheme: value.colorScheme,
    density: value.density,
    productMediaRatio: '1:1',
    recipe,
    installPrompt: value.installPrompt,
    tokens: tokens as ThemeTokens,
  };
}

function syncThemeColor(themeColor: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = themeColor;
}

function applyTheme(theme: PublicTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme.key;
  root.dataset.colorScheme = theme.colorScheme;
  root.dataset.density = theme.density;
  root.dataset.fontPack = theme.recipe.fontPack;
  root.dataset.buttonStyle = theme.recipe.buttonStyle;
  root.dataset.mediaStyle = theme.recipe.mediaStyle;
  root.dataset.motionStyle = theme.recipe.motionStyle;
  root.dataset.navigationStyle = theme.recipe.navigationStyle;
  root.style.colorScheme = theme.colorScheme;
  root.style.setProperty('--brand', theme.tokens.brand);
  root.style.setProperty('--brand-strong', theme.tokens.brandStrong);
  root.style.setProperty(
    '--theme-on-brand',
    storefrontBrandForeground(theme.tokens.brand, theme.colorScheme),
  );
  root.style.setProperty('--text', theme.tokens.text);
  root.style.setProperty('--muted', theme.tokens.muted);
  root.style.setProperty('--surface', theme.tokens.surface);
  root.style.setProperty('--surface-soft', theme.tokens.surfaceSoft);
  root.style.setProperty('--line', theme.tokens.line);
  root.style.setProperty('--page-bg', theme.tokens.pageBg);
  root.style.setProperty('--hero-start', theme.tokens.heroStart);
  root.style.setProperty('--hero-end', theme.tokens.heroEnd);
  root.style.setProperty('--hero-glow', theme.tokens.heroGlow);
  root.style.setProperty('--shadow', theme.tokens.shadow);
  root.style.setProperty('--product-media-ratio', '1 / 1');
  syncThemeColor(theme.tokens.pageBg);
}

function readCachedTheme(): PublicTheme | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) {
      const value = JSON.parse(raw) as unknown;
      if (validTheme(value)) return value;
    }
    for (const legacyKey of LEGACY_CACHE_KEYS) {
      const legacyRaw = window.localStorage.getItem(legacyKey);
      if (!legacyRaw) continue;
      const upgraded = upgradeLegacyTheme(JSON.parse(legacyRaw) as unknown);
      if (upgraded) return upgraded;
    }
    return null;
  } catch {
    return null;
  }
}

function cacheTheme(theme: PublicTheme): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(theme));
  } catch {
    // Theme caching is optional; the live runtime remains authoritative.
  }
}

export function installCachedStorefrontTheme(): PublicTheme | null {
  const cached = readCachedTheme();
  if (cached) applyTheme(cached);
  return cached;
}

export function applyStorefrontTheme(theme: PublicTheme): boolean {
  if (!validTheme(theme)) return false;
  applyTheme(theme);
  cacheTheme(theme);
  return true;
}

export async function installStorefrontTheme(): Promise<PublicTheme | null> {
  const cached = installCachedStorefrontTheme();

  try {
    const response = await fetch('/api/public/theme', {
      method: 'GET',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return cached;
    const body = (await response.json()) as unknown;
    if (!isRecord(body) || !validTheme(body.theme)) return cached;
    applyStorefrontTheme(body.theme);
    return body.theme;
  } catch {
    // Keep the cached/default theme when the theme endpoint is temporarily unavailable.
    return cached;
  }
}
