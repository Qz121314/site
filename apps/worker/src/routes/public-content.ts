import { Hono, type Context } from 'hono';
import {
  publicSnapshotCacheControl,
  publicSnapshotObjectKey,
} from '../public-content/public-snapshot';
import type { AppEnvironment } from '../types';

export const publicContentRoutes = new Hono<AppEnvironment>();

function notFound(context: Context<AppEnvironment>) {
  context.header('Cache-Control', 'no-store');
  return context.json(
    {
      error: {
        code: 'PUBLIC_CONTENT_NOT_FOUND',
        message: 'Published content was not found.',
        requestId: context.get('requestId'),
      },
    },
    404,
  );
}

async function servePublicContent(context: Context<AppEnvironment>, headOnly: boolean) {
  const objectKey = publicSnapshotObjectKey(context.req.param('*'));
  if (!objectKey) return notFound(context);

  const object = headOnly
    ? await context.env.ASSETS_BUCKET.head(objectKey)
    : await context.env.ASSETS_BUCKET.get(objectKey);
  if (!object) return notFound(context);

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/json; charset=utf-8');
  headers.set(
    'Cache-Control',
    publicSnapshotCacheControl(objectKey, object.httpMetadata?.cacheControl),
  );
  headers.set('Content-Length', String(object.size));
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (headOnly) return new Response(null, { status: 200, headers });
  return new Response(object.body, { status: 200, headers });
}

publicContentRoutes.get('/*', (context) => servePublicContent(context, false));
publicContentRoutes.head('/*', (context) => servePublicContent(context, true));
