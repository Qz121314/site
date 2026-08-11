import { Hono } from 'hono';
import { readModularPointer } from '../publishing/modular-publisher';
import {
  filterHomeLayoutByPublishedSections,
  getHomeLayout,
} from '../settings/home-layout';
import type { AppEnvironment } from '../types';

export const publicHomeLayoutRoutes = new Hono<AppEnvironment>();

publicHomeLayoutRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'public, max-age=30, must-revalidate');

  const [layout, pointerResult] = await Promise.all([
    getHomeLayout(context.env.DB),
    readModularPointer(context.env.ASSETS_BUCKET),
  ]);
  const pointer = pointerResult.pointer;
  if (!pointer) {
    return context.json({ pointerVersion: null, layout });
  }

  return context.json({
    pointerVersion: pointer.contentVersion,
    layout: filterHomeLayoutByPublishedSections(
      layout,
      new Set(Object.keys(pointer.sections)),
    ),
  });
});
