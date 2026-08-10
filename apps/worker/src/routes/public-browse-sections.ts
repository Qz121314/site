import { Hono } from 'hono';
import { buildAssetPublicUrl } from '../assets/asset-library';
import type { AppEnvironment } from '../types';

type BrowseSectionRow = {
  id: string;
  description: string | null;
  background_object_key: string | null;
  media_base_url: string | null;
  product_count: number;
};

export const publicBrowseSectionRoutes = new Hono<AppEnvironment>();

publicBrowseSectionRoutes.get('/', async (context) => {
  const rows = (
    await context.env.DB.prepare(
      `SELECT
           s.id,
           s.description,
           background.object_key AS background_object_key,
           settings.media_base_url,
           (
             SELECT COUNT(*)
             FROM products p
             WHERE p.section_id = s.id
               AND p.deleted_at IS NULL
               AND p.status = 'published'
           ) AS product_count
         FROM sections s
         LEFT JOIN media_assets background
           ON background.id = s.browse_background_asset_id
          AND background.status = 'ready'
          AND background.deleted_at IS NULL
         LEFT JOIN site_settings settings ON settings.id = 1
         WHERE s.deleted_at IS NULL
           AND s.is_enabled = 1
         ORDER BY s.sort_order ASC, s.name COLLATE NOCASE ASC`,
    ).all<BrowseSectionRow>()
  ).results;

  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  return context.json({
    sections: rows.map((row) => ({
      id: row.id,
      description: row.description,
      backgroundUrl: row.background_object_key
        ? buildAssetPublicUrl(row.media_base_url, row.background_object_key)
        : null,
      productCount: row.product_count,
    })),
  });
});
