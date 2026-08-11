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

type PublicTheme = {
  key: string;
  colorScheme: 'light' | 'dark';
  density: ThemeDensity;
  productMediaRatio: '1:1';
  tokens: ThemeTokens;
};

const CACHE_KEY = 'storefront-theme-v2';
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

function validTheme(value: unknown): value is PublicTheme {
  if (!isRecord(value) || typeof value.key !== 'string') return false;
  if (value.colorScheme !== 'light' && value.colorScheme !== 'dark') return false;
  if (!isThemeDensity(value.density)) return false;
  if (value.productMediaRatio !== '1:1') return false;
  const tokens = value.tokens;
  if (!isRecord(tokens)) return false;
  return TOKEN_KEYS.every((key) => typeof tokens[key] === 'string');
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
  root.style.colorScheme = theme.colorScheme;
  root.style.setProperty('--brand', theme.tokens.brand);
  root.style.setProperty('--brand-strong', theme.tokens.brandStrong);
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
  syncThemeColor(theme.tokens.brand);
}

function readCachedTheme(): PublicTheme | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    return validTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export async function installStorefrontTheme(): Promise<void> {
  const cached = readCachedTheme();
  if (cached) applyTheme(cached);

  try {
    const response = await fetch('/api/public/theme', {
      method: 'GET',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    const body = (await response.json()) as unknown;
    if (!isRecord(body) || !validTheme(body.theme)) return;
    applyTheme(body.theme);
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(body.theme));
    } catch {
      // Theme caching is optional; the live response remains authoritative.
    }
  } catch {
    // Keep the cached/default theme when the theme endpoint is temporarily unavailable.
  }
}
