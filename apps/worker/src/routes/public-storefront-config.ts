import { Hono } from 'hono';
import type { AppEnvironment } from '../types';

export const publicStorefrontConfigRoutes = new Hono<AppEnvironment>();

publicStorefrontConfigRoutes.get('/content-origin', (context) => {
  const contentOrigin = new URL(context.req.url).origin;

  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  return context.json({ contentOrigin });
});
