import { Hono } from 'hono';
import { getSiteSettings } from '../settings/site-settings';
import type { AppEnvironment } from '../types';

export const publicPwaRoutes = new Hono<AppEnvironment>();

type JsonRecord = Record<string, unknown>;

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

async function resolvePublishedSiteName(context: { env: AppEnvironment['Bindings'] }): Promise<string> {
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

function shortName(value: string): string {
  const normalized = value.trim();
  return normalized.length <= 30 ? normalized : `${normalized.slice(0, 29).trimEnd()}…`;
}

publicPwaRoutes.get('/manifest.webmanifest', async (context) => {
  const name = await resolvePublishedSiteName(context);
  const manifest = {
    id: '/',
    name,
    short_name: shortName(name),
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f6f7',
    theme_color: '#ff5a1f',
    icons: [
      {
        src: '/icons/app-icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/app-icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  };

  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  context.header('Content-Type', 'application/manifest+json; charset=utf-8');
  return context.body(JSON.stringify(manifest));
});
