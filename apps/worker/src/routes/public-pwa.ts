import type { Context } from 'hono';
import { getSiteSettings } from '../settings/site-settings';
import { getThemeSettings, resolveTheme } from '../theme/theme-center';
import type { AppEnvironment } from '../types';

type JsonRecord = Record<string, unknown>;

type ManifestTheme = {
  backgroundColor: string;
  themeColor: string;
};

type LogoAssetRow = {
  object_key: string;
};

const PWA_ICON_SIZES = new Set([192, 512]);
const PWA_ICON_SAFE_AREA_RATIO = 0.8;
const PWA_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600';

const DEFAULT_MANIFEST_THEME: ManifestTheme = {
  backgroundColor: '#f5f6f7',
  themeColor: '#ff5a1f',
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validPublishedObjectKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!/^public\/(?:versions|modules)\/[A-Za-z0-9._/-]+\.json$/u.test(value)) return null;
  if (value.includes('..')) return null;
  return value;
}

function pointerManifestKey(pointer: unknown): string | null {
  if (!isRecord(pointer)) return null;
  if (pointer.schemaVersion === 2 && isRecord(pointer.site)) {
    return validPublishedObjectKey(pointer.site.manifestKey);
  }
  if (pointer.schemaVersion === 1) {
    return validPublishedObjectKey(pointer.manifestKey);
  }
  return null;
}

function publishedSiteName(snapshot: unknown): string | null {
  if (!isRecord(snapshot) || !isRecord(snapshot.site)) return null;

  const directName = snapshot.site.name;
  if (typeof directName === 'string' && directName.trim()) return directName.trim();

  if (isRecord(snapshot.site.site)) {
    const nestedName = snapshot.site.site.name;
    if (typeof nestedName === 'string' && nestedName.trim()) return nestedName.trim();
  }

  return null;
}

async function readJsonObject(bucket: R2Bucket, key: string): Promise<unknown | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text()) as unknown;
  } catch {
    return null;
  }
}

async function resolvePublishedSiteName(
  context: Context<AppEnvironment>,
): Promise<string> {
  const pointer = await readJsonObject(context.env.ASSETS_BUCKET, 'public/current.json');
  const manifestKey = pointerManifestKey(pointer);
  if (manifestKey) {
    const snapshot = await readJsonObject(context.env.ASSETS_BUCKET, manifestKey);
    const name = publishedSiteName(snapshot);
    if (name) return name;
  }

  try {
    return (await getSiteSettings(context.env.DB)).siteName;
  } catch {
    return 'App';
  }
}

async function resolveManifestTheme(
  context: Context<AppEnvironment>,
): Promise<ManifestTheme> {
  try {
    const theme = resolveTheme(await getThemeSettings(context.env.DB));
    return {
      backgroundColor: theme.tokens.pageBg,
      themeColor: theme.tokens.brand,
    };
  } catch {
    return DEFAULT_MANIFEST_THEME;
  }
}

function shortName(value: string): string {
  const normalized = value.trim();
  return normalized.length <= 30 ? normalized : `${normalized.slice(0, 29).trimEnd()}…`;
}

export async function servePwaManifest(context: Context<AppEnvironment>) {
  const [name, theme] = await Promise.all([
    resolvePublishedSiteName(context),
    resolveManifestTheme(context),
  ]);
  const manifest = {
    id: '/',
    name,
    short_name: shortName(name),
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: theme.backgroundColor,
    theme_color: theme.themeColor,
    icons: [
      {
        src: '/api/public/pwa/icon/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/public/pwa/icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };

  context.header('Cache-Control', PWA_CACHE_CONTROL);
  context.header('Content-Type', 'application/manifest+json; charset=utf-8');
  return context.body(JSON.stringify(manifest));
}

async function loadLogoStream(
  context: Context<AppEnvironment>,
): Promise<ReadableStream<Uint8Array> | null> {
  const asset = await context.env.DB.prepare(
    `SELECT logo.object_key
       FROM site_settings settings
       JOIN media_assets logo ON logo.id = settings.logo_asset_id
      WHERE settings.id = 1
        AND logo.status = 'ready'
        AND logo.deleted_at IS NULL
        AND logo.mime_type LIKE 'image/%'`,
  ).first<LogoAssetRow>();
  if (!asset) return null;
  return (await context.env.ASSETS_BUCKET.get(asset.object_key))?.body ?? null;
}

async function loadDefaultIconStream(
  context: Context<AppEnvironment>,
): Promise<ReadableStream<Uint8Array>> {
  const url = new URL('/icons/app-icon-512.png', context.req.url);
  const response = await context.env.ASSETS.fetch(new Request(url));
  if (!response.ok || !response.body) throw new Error('PWA_DEFAULT_ICON_MISSING');
  return response.body;
}

async function transformPwaIcon(
  context: Context<AppEnvironment>,
  stream: ReadableStream<Uint8Array>,
  size: number,
  background: string,
): Promise<Response> {
  const safeSize = Math.round(size * PWA_ICON_SAFE_AREA_RATIO);
  const transformed = (
    await context.env.IMAGES.input(stream)
      .transform({ width: safeSize, height: safeSize, fit: 'contain' })
      .transform({ width: size, height: size, fit: 'pad', background })
      .output({ format: 'image/png', anim: false })
  ).response();
  const headers = new Headers(transformed.headers);
  headers.set('content-type', 'image/png');
  headers.set('cache-control', PWA_CACHE_CONTROL);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
}

export async function servePwaIcon(context: Context<AppEnvironment>) {
  const size = Number(context.req.param('size'));
  if (!PWA_ICON_SIZES.has(size)) return context.notFound();

  const theme = await resolveManifestTheme(context);
  try {
    const logo = await loadLogoStream(context);
    if (logo) return await transformPwaIcon(context, logo, size, theme.backgroundColor);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'pwa.logo_icon_failed',
        size,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown PWA icon error',
      }),
    );
  }

  return transformPwaIcon(
    context,
    await loadDefaultIconStream(context),
    size,
    theme.backgroundColor,
  );
}
