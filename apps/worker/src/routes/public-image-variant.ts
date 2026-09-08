import { Hono, type Context } from 'hono';
import {
  publicImageVariantRequest,
  resolvePublicImageVariant,
} from '../public-media/public-image-variant';
import type { AppEnvironment } from '../types';

export const publicImageVariantRoutes = new Hono<AppEnvironment>();

function workerCache(): Cache | null {
  if (typeof caches === 'undefined') return null;
  return (caches as unknown as { default?: Cache }).default ?? null;
}

function notFound() {
  return new Response(null, {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function imageHeaders(source: R2Object, contentType = 'image/webp'): Headers {
  const headers = new Headers({
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': contentType,
    'Cross-Origin-Resource-Policy': 'same-origin',
    ETag: source.httpEtag,
    'X-Content-Type-Options': 'nosniff',
  });
  return headers;
}

async function serveVariant(context: Context<AppEnvironment>) {
  const cacheKey = new Request(new URL(context.req.url).toString(), {
    method: 'GET',
  });
  const cache = workerCache();
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) return cached;

  const pathname = new URL(context.req.url).pathname;
  if (!publicImageVariantRequest(pathname)) return notFound();

  const variant = await resolvePublicImageVariant(context.env.DB, pathname);
  if (!variant) return notFound();

  const source = await context.env.ASSETS_BUCKET.get(variant.objectKey);
  if (!source) return notFound();
  const sourceBytes = await source.arrayBuffer();

  try {
    const sourceStream = new Response(sourceBytes).body;
    if (!sourceStream) return notFound();
    const transformed = (
      await context.env.IMAGES.input(sourceStream)
        .transform({
          width: variant.width,
          height: variant.width,
          fit: 'cover',
        })
        .output({
          format: 'image/webp',
          quality: 74,
          anim: false,
        })
    ).response();
    const headers = imageHeaders(
      source,
      transformed.headers.get('content-type') ?? 'image/webp',
    );
    const response = new Response(transformed.body, {
      status: transformed.status,
      statusText: transformed.statusText,
      headers,
    });
    if (cache) context.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'public.image_variant_failed',
        objectKey: variant.objectKey,
        width: variant.width,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage:
          error instanceof Error ? error.message : 'Unknown image transformation error',
      }),
    );
    const headers = imageHeaders(
      source,
      source.httpMetadata?.contentType ?? 'application/octet-stream',
    );
    headers.set('Cache-Control', 'public, max-age=60, must-revalidate');
    const response = new Response(sourceBytes, { headers });
    if (cache) context.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
}

publicImageVariantRoutes.get('*', serveVariant);
