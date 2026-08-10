import { Hono, type Context } from 'hono';
import {
  isPublicMediaAsset,
  publicMediaFallbackObjectKey,
} from '../public-media/public-media-fallback';
import type { AppEnvironment } from '../types';

export const publicMediaFallbackRoutes = new Hono<AppEnvironment>();

function notFound(_context: Context<AppEnvironment>) {
  return new Response(null, {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function invalidRange() {
  return new Response(null, {
    status: 416,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Range': 'bytes */*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function requestObjectKey(context: Context<AppEnvironment>): string | null {
  const pathname = new URL(context.req.url).pathname;
  const prefix = '/_media/';
  return publicMediaFallbackObjectKey(
    pathname.startsWith(prefix)
      ? pathname.slice(prefix.length)
      : pathname.replace(/^\/+/, ''),
  );
}

function validRangeHeader(value: string | undefined): boolean {
  if (!value) return true;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim());
  return Boolean(match && (match[1] || match[2]));
}

function responseHeaders(object: R2Object): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has('Content-Type'))
    headers.set('Content-Type', 'application/octet-stream');
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  headers.set('Accept-Ranges', 'bytes');
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (object.range) {
    const range = object.range;
    const offset =
      'offset' in range && typeof range.offset === 'number'
        ? range.offset
        : 'suffix' in range && typeof range.suffix === 'number'
          ? Math.max(0, object.size - range.suffix)
          : 0;
    const length =
      'length' in range && typeof range.length === 'number'
        ? range.length
        : 'suffix' in range && typeof range.suffix === 'number'
          ? Math.min(range.suffix, object.size)
          : object.size - offset;
    headers.set('Content-Length', String(length));
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
  } else {
    headers.set('Content-Length', String(object.size));
  }

  return headers;
}

async function resolveTrackedKey(
  context: Context<AppEnvironment>,
): Promise<string | null> {
  const objectKey = requestObjectKey(context);
  if (!objectKey || !(await isPublicMediaAsset(context.env.DB, objectKey))) return null;
  return objectKey;
}

async function serveGet(context: Context<AppEnvironment>) {
  const rangeHeader = context.req.header('range');
  if (!validRangeHeader(rangeHeader)) return invalidRange();

  const objectKey = await resolveTrackedKey(context);
  if (!objectKey) return notFound(context);

  const object = await context.env.ASSETS_BUCKET.get(
    objectKey,
    rangeHeader ? { range: context.req.raw.headers } : undefined,
  );
  if (!object) return notFound(context);

  return new Response(object.body, {
    status: object.range ? 206 : 200,
    headers: responseHeaders(object),
  });
}

async function serveHead(context: Context<AppEnvironment>) {
  const objectKey = await resolveTrackedKey(context);
  if (!objectKey) return notFound(context);

  const object = await context.env.ASSETS_BUCKET.head(objectKey);
  if (!object) return notFound(context);
  return new Response(null, { status: 200, headers: responseHeaders(object) });
}

publicMediaFallbackRoutes.get('*', serveGet);
publicMediaFallbackRoutes.on('HEAD', '*', serveHead);
