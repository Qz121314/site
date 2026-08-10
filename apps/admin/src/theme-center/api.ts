import { AdminApiError } from '../api';
import { adminFetch } from '../admin-fetch';

export type OfficialThemeKey =
  'marketplace' | 'noir' | 'live' | 'saas' | 'travel' | 'tech';
export type ThemeKey = OfficialThemeKey | 'custom';

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
  imported?: ImportedThemeDefinition;
};

export type ThemePreset = {
  key: ThemeKey;
  label: string;
  description: string;
  colorScheme: 'light' | 'dark';
  density: 'compact' | 'standard' | 'comfortable';
  productMediaRatio: '1:1';
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
  imported?: ImportedThemeDefinition,
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
        ...(themeKey === 'custom' && imported ? { imported } : {}),
      },
    }),
  });
  const envelope = isRecord(body) ? body : null;
  return parseTheme(envelope?.theme);
}
