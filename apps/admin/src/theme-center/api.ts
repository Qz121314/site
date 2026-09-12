import { AdminApiError } from '../api';
import { adminFetch } from '../admin-fetch';

export type OfficialThemeKey =
  | 'marketplace'
  | 'noir'
  | 'live'
  | 'velvet'
  | 'midnight'
  | 'pearl'
  | 'saas'
  | 'travel'
  | 'tech';
export type ThemeKey = OfficialThemeKey | 'custom';

export type ThemePreviewContent = {
  siteName: string;
  locationLabel: string;
  logoUrl: string | null;
  sections: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    iconUrl: string | null;
  }>;
  products: Array<{
    id: string;
    slug: string;
    sectionId: string;
    title: string;
    coverUrl: string | null;
  }>;
  navigation: Array<{ href: string; label: string }>;
};
export type ThemeDensity = 'compact' | 'standard' | 'comfortable';
export type ThemeFontPack = 'modern' | 'editorial' | 'compact' | 'technical';
export type ThemeButtonStyle = 'refined' | 'minimal' | 'soft-pill';
export type ThemeMediaStyle = 'precise' | 'soft' | 'editorial';
export type ThemeMotionStyle = 'restrained' | 'gentle' | 'active';
export type ThemeNavigationStyle = 'quiet' | 'tinted' | 'solid';

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

export type ImportedThemeDefinition = {
  source: 'shadcn' | 'json';
  sourceUrl?: string;
  label: string;
  description: string;
  colorScheme: 'light' | 'dark';
  tokens: ThemeTokens;
};

export type ThemeOverrides = {
  accent?: string;
  textColor?: string;
  density?: ThemeDensity;
  fontPack?: ThemeFontPack;
  buttonStyle?: ThemeButtonStyle;
  mediaStyle?: ThemeMediaStyle;
  motionStyle?: ThemeMotionStyle;
  navigationStyle?: ThemeNavigationStyle;
  installPrompt?: ThemeInstallPrompt;
  imported?: ImportedThemeDefinition;
};

export type ThemeVisualOverrides = Pick<
  ThemeOverrides,
  | 'density'
  | 'fontPack'
  | 'buttonStyle'
  | 'mediaStyle'
  | 'motionStyle'
  | 'navigationStyle'
>;

export type ThemePreset = {
  key: ThemeKey;
  label: string;
  description: string;
  colorScheme: 'light' | 'dark';
  density: ThemeDensity;
  productMediaRatio: '1:1';
  recipe: ThemeRecipe;
  installPrompt: ThemeInstallPrompt;
  tokens: ThemeTokens;
};

export type ResolvedTheme = ThemePreset & {
  overrides: ThemeOverrides;
};

export type ThemeCenterResponse = {
  theme: ResolvedTheme;
  presets: ThemePreset[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : null;
}

async function themeRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await adminFetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);
  if (!response.ok) {
    const envelope = isRecord(body) && isRecord(body.error) ? body.error : null;
    const details = envelope && isRecord(envelope.details) ? envelope.details : null;
    throw new AdminApiError(
      response.status,
      envelope && typeof envelope.code === 'string' ? envelope.code : 'REQUEST_FAILED',
      envelope && typeof envelope.message === 'string'
        ? envelope.message
        : '主题中心请求失败。',
      details && typeof details.field === 'string' ? { field: details.field } : undefined,
    );
  }
  return body;
}

function parseTheme(value: unknown): ResolvedTheme {
  const record = isRecord(value) ? value : null;
  if (!record || typeof record.key !== 'string' || typeof record.label !== 'string') {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '主题中心返回数据无效。');
  }
  return record as unknown as ResolvedTheme;
}

export async function fetchThemeCenter(): Promise<ThemeCenterResponse> {
  const body = await themeRequest('/api/admin/theme/');
  const envelope = isRecord(body) ? body : null;
  if (!envelope || !Array.isArray(envelope.presets)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '主题中心返回数据无效。');
  }
  return {
    theme: parseTheme(envelope.theme),
    presets: envelope.presets as ThemePreset[],
  };
}

function objectUrl(baseUrl: string, objectKey: unknown): string | null {
  if (typeof objectKey !== 'string' || !objectKey.trim() || objectKey.includes('..')) {
    return null;
  }
  return `${baseUrl.replace(/\/$/u, '')}/${objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

export async function loadThemePreviewContent(): Promise<ThemePreviewContent> {
  const response = await fetch('/api/public/storefront/bootstrap', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const body = (await readJson(response)) as Record<string, unknown> | null;
  if (!response.ok || !body) {
    throw new AdminApiError(
      500,
      'PREVIEW_CONTENT_UNAVAILABLE',
      '无法读取已发布的前端预览数据。',
    );
  }
  const site = isRecord(body.site) && isRecord(body.site.site) ? body.site.site : {};
  const home = isRecord(body.home) ? body.home : {};
  const mediaBaseUrl = typeof body.mediaBaseUrl === 'string' ? body.mediaBaseUrl : '';
  const rawSections = Array.isArray(home.allSections)
    ? home.allSections
    : Array.isArray(home.sections)
      ? home.sections
      : [];
  const sections = rawSections
    .flatMap((value) => {
      if (!isRecord(value)) return [];
      const icon = isRecord(value.icon) ? value.icon : {};
      return [
        {
          id: typeof value.id === 'string' ? value.id : '',
          slug: typeof value.slug === 'string' ? value.slug : '',
          name: typeof value.name === 'string' ? value.name : '',
          description: typeof value.description === 'string' ? value.description : '',
          iconUrl: objectUrl(mediaBaseUrl, icon.objectKey),
        },
      ];
    })
    .filter((section) => section.id && section.slug && section.name);
  const products = (Array.isArray(home.featuredProducts) ? home.featuredProducts : [])
    .flatMap((value) => {
      if (!isRecord(value)) return [];
      return [
        {
          id: typeof value.id === 'string' ? value.id : '',
          slug: typeof value.slug === 'string' ? value.slug : '',
          sectionId: typeof value.sectionId === 'string' ? value.sectionId : '',
          title: typeof value.title === 'string' ? value.title : '',
          coverUrl: objectUrl(mediaBaseUrl, value.coverObjectKey),
        },
      ];
    })
    .filter(
      (product) => product.id && product.slug && product.sectionId && product.title,
    );
  const navigation = (
    Array.isArray(body.bottomNavigation) ? body.bottomNavigation : []
  ).flatMap((value) => {
    if (!isRecord(value)) return [];
    const href = typeof value.href === 'string' ? value.href : '';
    const label = typeof value.label === 'string' ? value.label : '';
    return href && label ? [{ href, label }] : [];
  });
  return {
    siteName: typeof site.name === 'string' ? site.name : '',
    locationLabel: typeof site.locationLabel === 'string' ? site.locationLabel : '',
    logoUrl: objectUrl(mediaBaseUrl, site.logoObjectKey),
    sections,
    products,
    navigation,
  };
}

export async function importThemeFromRegistry(
  url: string,
  mode: 'light' | 'dark',
): Promise<ResolvedTheme> {
  const body = await themeRequest('/api/admin/theme/import', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({ source: 'url', url, mode }),
  });
  return parseTheme(isRecord(body) ? body.theme : null);
}

export async function importThemeFromJson(
  json: string,
  mode: 'light' | 'dark',
): Promise<ResolvedTheme> {
  const body = await themeRequest('/api/admin/theme/import', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({ source: 'json', json, mode }),
  });
  return parseTheme(isRecord(body) ? body.theme : null);
}

export async function updateThemeCenter(
  themeKey: ThemeKey,
  accent: string | null,
  textColor: string | null,
  imported?: ImportedThemeDefinition,
  visualOverrides: ThemeVisualOverrides = {},
): Promise<ResolvedTheme> {
  const body = await themeRequest('/api/admin/theme/', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({
      themeKey,
      overrides: {
        ...(accent ? { accent } : {}),
        ...(textColor ? { textColor } : {}),
        ...visualOverrides,
        ...(themeKey === 'custom' && imported ? { imported } : {}),
      },
    }),
  });
  const envelope = isRecord(body) ? body : null;
  return parseTheme(envelope?.theme);
}
