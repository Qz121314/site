import { Hono } from 'hono';
import { hasEnabledCustomerServiceConnection } from '../customer-service/customer-service-connections';
import { buildMediaUrl } from '../media/media-url';
import {
  getBottomNavigation,
  getReadyBottomNavigationAssets,
  type BottomNavigationItem,
} from '../settings/bottom-navigation';
import { getSiteSettings } from '../settings/site-settings';
import type { AppEnvironment } from '../types';

export const publicBottomNavigationRoutes = new Hono<AppEnvironment>();

export function isPublicBottomNavigationItemEnabled(
  item: Pick<BottomNavigationItem, 'key' | 'enabled'>,
  supportAvailable: boolean,
): boolean {
  return item.enabled && (item.key !== 'messages' || supportAvailable);
}

publicBottomNavigationRoutes.get('/', async (context) => {
  const [settings, items, supportAvailable] = await Promise.all([
    getSiteSettings(context.env.DB),
    getBottomNavigation(context.env.DB),
    hasEnabledCustomerServiceConnection(context.env.DB),
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
        enabled: isPublicBottomNavigationItemEnabled(item, supportAvailable),
        icon,
      };
    }),
  });
});
