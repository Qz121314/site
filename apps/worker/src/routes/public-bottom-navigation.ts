import { Hono } from 'hono';
import { buildMediaUrl } from '../media/media-url';
import {
  getBottomNavigation,
  getReadyBottomNavigationAssets,
} from '../settings/bottom-navigation';
import { getSiteSettings } from '../settings/site-settings';
import type { AppEnvironment } from '../types';

export const publicBottomNavigationRoutes = new Hono<AppEnvironment>();

publicBottomNavigationRoutes.get('/', async (context) => {
  const [settings, items] = await Promise.all([
    getSiteSettings(context.env.DB),
    getBottomNavigation(context.env.DB),
  ]);
  const assetIds = items
    .filter((item) => item.iconType === 'asset' && item.iconAssetId)
    .map((item) => item.iconAssetId as string);
  const assets = await getReadyBottomNavigationAssets(context.env.DB, assetIds);

  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  return context.json({
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
});
