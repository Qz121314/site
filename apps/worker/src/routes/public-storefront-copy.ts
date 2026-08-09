import { Hono } from 'hono';
import { getSiteSettings } from '../settings/site-settings';
import type { AppEnvironment } from '../types';

export const publicStorefrontCopyRoutes = new Hono<AppEnvironment>();

publicStorefrontCopyRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  const settings = await getSiteSettings(context.env.DB);
  return context.json({ copy: settings.storefrontCopy });
});
