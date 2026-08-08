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

type PublicTheme = {
  key: string;
  colorScheme: 'light' | 'dark';
  productMediaRatio: '1:1';
  tokens: ThemeTokens;
};

const CACHE_KEY = 'storefront-theme-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTheme(value: unknown): value is PublicTheme {
  if (!isRecord(value) || typeof value.key !== 'string') return false;
  if (value.colorScheme !== 'light' && value.colorScheme !== 'dark') return false;
  if (value.productMediaRatio !== '1:1' || !isRecord(value.tokens)) return false;
  return [
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
  ].every((key) => typeof value.tokens[key] === 'string');
}

function applyTheme(theme: PublicTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme.key;
  root.dataset.colorScheme = theme.colorScheme;
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
