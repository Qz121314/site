import { Hono } from 'hono';
import { getThemeSettings, resolveTheme } from '../theme/theme-center';
import type { AppEnvironment } from '../types';

export const publicThemeRoutes = new Hono<AppEnvironment>();

publicThemeRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  const theme = resolveTheme(await getThemeSettings(context.env.DB));
  return context.json({ theme });
});
