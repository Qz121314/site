import { Hono } from 'hono';
import { resolvePublicCta } from '../conversion-pool/public-cta';
import type { AppEnvironment } from '../types';

export const publicStorefrontConfigRoutes = new Hono<AppEnvironment>();

publicStorefrontConfigRoutes.get('/content-origin', (context) => {
  const contentOrigin = new URL(context.req.url).origin;

  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  return context.json({ contentOrigin });
});

publicStorefrontConfigRoutes.get('/cta/:productId', async (context) => {
  context.header('Cache-Control', 'no-store');
  context.header('X-Robots-Tag', 'noindex, nofollow');

  const productId = context.req.param('productId').trim();
  if (!productId || productId.length > 100 || !/^[A-Za-z0-9-]+$/u.test(productId)) {
    return context.json({ available: false });
  }

  const { cta } = await resolvePublicCta(context.env.DB, productId);
  return cta
    ? context.json({ available: true, ...cta })
    : context.json({ available: false });
});
