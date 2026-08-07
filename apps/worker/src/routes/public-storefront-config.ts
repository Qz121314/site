import { Hono } from 'hono';
import type { AppEnvironment } from '../types';

export const publicStorefrontConfigRoutes = new Hono<AppEnvironment>();

publicStorefrontConfigRoutes.get('/content-origin', async (context) => {
  const row = await context.env.DB
    .prepare('SELECT media_base_url FROM site_settings WHERE id = 1')
    .first<{ media_base_url: string | null }>();
  const contentOrigin = row?.media_base_url?.trim() || null;

  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  return context.json({ contentOrigin });
});
