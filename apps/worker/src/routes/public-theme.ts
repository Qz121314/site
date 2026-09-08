import { Hono, type Context } from 'hono';
import { getThemeSettings, resolveTheme } from '../theme/theme-center';
import type { AppEnvironment } from '../types';

export const publicThemeRoutes = new Hono<AppEnvironment>();

function workerCache(): Cache | null {
  if (typeof caches === 'undefined') return null;
  return (caches as unknown as { default?: Cache }).default ?? null;
}

async function cachedTheme(context: Context<AppEnvironment>) {
  const cacheKey = new Request(new URL(context.req.url).toString(), { method: 'GET' });
  const cache = workerCache();
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) return cached;

  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  const response = context.json({
    theme: resolveTheme(await getThemeSettings(context.env.DB)),
  });
  if (cache) context.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

publicThemeRoutes.get('/', cachedTheme);
