import { Hono } from 'hono';
import { getHomeLayout } from '../settings/home-layout';
import type { AppEnvironment } from '../types';

export const publicHomeLayoutRoutes = new Hono<AppEnvironment>();

publicHomeLayoutRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  return context.json({ layout: await getHomeLayout(context.env.DB) });
});
