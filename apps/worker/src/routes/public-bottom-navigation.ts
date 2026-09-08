import { Hono, type Context } from 'hono';
import { buildMediaUrl } from '../media/media-url';
import {
  getBottomNavigation,
  getReadyBottomNavigationAssets,
} from '../settings/bottom-navigation';
import { getSiteSettings } from '../settings/site-settings';
import type { AppEnvironment } from '../types';

export const publicBottomNavigationRoutes = new Hono<AppEnvironment>();

function workerCache(): Cache | null {
  if (typeof caches === 'undefined') return null;
  return (caches as unknown as { default?: Cache }).default ?? null;
}

async function cachedBottomNavigation(context: Context<AppEnvironment>) {
  const cacheKey = new Request(new URL(context.req.url).toString(), { method: 'GET' });
  const cache = workerCache();
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) return cached;

  const [settings, items] = await Promise.all([
    getSiteSettings(context.env.DB),
    getBottomNavigation(context.env.DB),
  ]);
  const assetIds = items
    .filter((item) => item.iconType === 'asset' && item.iconAssetId)
    .map((item) => item.iconAssetId as string);
  const assets = await getReadyBottomNavigationAssets(context.env.DB, assetIds);

  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  const response = context.json({
    items: items.map((item) => {
      let icon: { type: 'builtin' | 'emoji' | 'image'; value: string | null };
      if (item.iconType === 'asset') {
        const objectKey = item.iconAssetId
          ? (assets.get(item.iconAssetId) ?? null)
          : null;
        icon = {
          type: 'image',
          value:
            settings.mediaBaseUrl && objectKey
              ? buildMediaUrl(settings.mediaBaseUrl, objectKey)
              : null,
        };
      } else {
        icon = { type: item.iconType, value: item.iconValue };
      }
      return {
        key: item.key,
        label: item.label,
        enabled: item.enabled,
        icon,
      };
    }),
  });
  if (cache) context.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

publicBottomNavigationRoutes.get('/', cachedBottomNavigation);
