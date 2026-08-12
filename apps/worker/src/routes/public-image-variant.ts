import { Hono, type Context } from 'hono';
import { resolvePublicImageVariant } from '../public-media/public-image-variant';
import type { AppEnvironment } from '../types';

export const publicImageVariantRoutes = new Hono<AppEnvironment>();

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
  const variant = await resolvePublicImageVariant(
    context.env.DB,
    new URL(context.req.url).pathname,
  );
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
    return new Response(transformed.body, {
      status: transformed.status,
      statusText: transformed.statusText,
      headers,
    });
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
    return new Response(sourceBytes, { headers });
  }
}

publicImageVariantRoutes.get('*', serveVariant);
