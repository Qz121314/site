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

function requestSnapshotPath(context: Context<AppEnvironment>): string {
  const pathname = new URL(context.req.url).pathname;
  if (pathname.startsWith('/public/')) return pathname.slice('/public/'.length);
  return pathname.replace(/^\/+/, '');
}

function responseHeaders(objectKey: string, object: R2Object): Headers {
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
  return headers;
}

async function serveGet(context: Context<AppEnvironment>) {
  const objectKey = publicSnapshotObjectKey(requestSnapshotPath(context));
  if (!objectKey) return notFound(context);

  const object = await context.env.ASSETS_BUCKET.get(objectKey);
  if (!object) return notFound(context);
  return new Response(object.body, {
    status: 200,
    headers: responseHeaders(objectKey, object),
  });
}

async function serveHead(context: Context<AppEnvironment>) {
  const objectKey = publicSnapshotObjectKey(requestSnapshotPath(context));
  if (!objectKey) return notFound(context);

  const object = await context.env.ASSETS_BUCKET.head(objectKey);
  if (!object) return notFound(context);
  return new Response(null, {
    status: 200,
    headers: responseHeaders(objectKey, object),
  });
}

publicContentRoutes.get('*', serveGet);
publicContentRoutes.on('HEAD', '*', serveHead);
