import { Hono, type Context } from 'hono';
import { getMediaBaseUrl } from '../assets/asset-library';
import { getConversionGroup } from '../conversion-pool/conversion-pool';
import { getRoutableProduct, resolvePublicCta } from '../conversion-pool/public-cta';
import {
  getCustomerServiceConnection,
  listCustomerServiceConnections,
  type CustomerServiceConnectionRecord,
} from '../customer-service/customer-service-connections';
import { loadStorefrontPublishedBootstrap } from '../publishing/storefront-bootstrap-snapshot';
import { materializeDerivedSearchSnapshot } from '../publishing/storefront-publisher';
import type { AppEnvironment } from '../types';

export const publicStorefrontConfigRoutes = new Hono<AppEnvironment>();

function workerCache(): Cache | null {
  if (typeof caches === 'undefined') return null;
  return (caches as unknown as { default?: Cache }).default ?? null;
}

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

type PublicSupportConnection = {
  id: string;
  clientApiUrl: string;
  realtimeUrl: string;
  protocolVersion: 'v1';
};

type JsonRecord = Record<string, unknown>;
function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function readPublishedJson(bucket: R2Bucket, key: string): Promise<unknown | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text()) as unknown;
  } catch {
    return null;
  }
}
function setPublicRuntimeHeaders(context: Context<AppEnvironment>) {
  context.header('Cache-Control', 'no-store');
  context.header('X-Robots-Tag', 'noindex, nofollow');
}

async function cachedPublicJson<T>(
  context: Context<AppEnvironment>,
  load: () => Promise<T>,
): Promise<Response> {
  const cacheKey = new Request(new URL(context.req.url).toString(), { method: 'GET' });
  const cache = workerCache();
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) return cached;

  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  const response = context.json(await load());
  if (cache) context.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
function toPublicSupportConnection(
  connection: CustomerServiceConnectionRecord,
): PublicSupportConnection | null {
  if (!connection.clientApiUrl || !connection.realtimeUrl || !connection.verifiedAt)
    return null;
  return {
    id: connection.id,
    clientApiUrl: connection.clientApiUrl,
    realtimeUrl: connection.realtimeUrl,
    protocolVersion: 'v1',
  };
}
function validPublicId(value: string): boolean {
  return Boolean(value && value.length <= 100 && /^[A-Za-z0-9-]+$/u.test(value));
}
function validPointerVersion(value: string): boolean {
  return Boolean(value && value.length <= 180 && /^[A-Za-z0-9-]+$/u.test(value));
}
function searchSnapshotKey(pointerVersion: string): string {
  return `public/search/${encodeURIComponent(pointerVersion)}/search.json`;
}

publicStorefrontConfigRoutes.get('/content-origin', async (context) => {
  return cachedPublicJson(context, async () => ({
    contentOrigin: await getMediaBaseUrl(context.env.DB),
  }));
});

publicStorefrontConfigRoutes.get('/media-base-url', async (context) => {
  return cachedPublicJson(context, async () => ({
    mediaBaseUrl: await getMediaBaseUrl(context.env.DB),
  }));
});

publicStorefrontConfigRoutes.get('/bootstrap', async (context) => {
  const cacheKey = new Request(new URL(context.req.url).toString(), {
    method: 'GET',
  });
  const cache = workerCache();
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) return cached;

  const pointerValue = await readPublishedJson(
    context.env.ASSETS_BUCKET,
    'public/current.json',
  );
  if (!isRecord(pointerValue) || pointerValue.schemaVersion !== 2) {
    return context.json({ available: false }, 404);
  }
  const publishedBootstrap = await loadStorefrontPublishedBootstrap(
    context.env.ASSETS_BUCKET,
    pointerValue,
  );
  if (!publishedBootstrap) {
    return context.json({ available: false }, 404);
  }
  const { site, sectionsIndex, home } = publishedBootstrap;

  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  const response = context.json({
    pointer: pointerValue,
    site,
    sectionsIndex,
    home,
    mediaBaseUrl: publishedBootstrap.runtime.mediaBaseUrl,
    theme: publishedBootstrap.runtime.theme,
    bottomNavigation: publishedBootstrap.runtime.bottomNavigation,
  });
  if (cache) context.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
});

publicStorefrontConfigRoutes.get('/search-index/:pointerVersion', async (context) => {
  const pointerVersion = context.req.param('pointerVersion').trim();
  if (!validPointerVersion(pointerVersion)) {
    return context.json({ available: false }, 404);
  }

  const key = searchSnapshotKey(pointerVersion);
  let object = await context.env.ASSETS_BUCKET.get(key);
  if (!object) {
    const materializedKey = await materializeDerivedSearchSnapshot(
      context.env.ASSETS_BUCKET,
    );
    if (materializedKey !== key) {
      return context.json({ available: false }, 404);
    }
    object = await context.env.ASSETS_BUCKET.get(key);
  }
  if (!object) return context.json({ available: false }, 404);

  const headers = new Headers();
  headers.set(
    'Content-Type',
    object.httpMetadata?.contentType ?? 'application/json; charset=utf-8',
  );
  headers.set('Cache-Control', object.httpMetadata?.cacheControl ?? IMMUTABLE_CACHE);
  headers.set('Content-Length', String(object.size));
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(object.body, { status: 200, headers });
});

publicStorefrontConfigRoutes.get('/cta/:productId', async (context) => {
  const productId = context.req.param('productId').trim();
  return cachedPublicJson(context, async () => {
    if (!validPublicId(productId)) return { available: false };
    const { cta } = await resolvePublicCta(context.env.DB, productId);
    return cta ? { available: true, ...cta } : { available: false };
  });
});

/**
 * Safe configuration discovery only. Storefront receives only the verified
 * public client endpoints needed to connect directly to customer-service.
 * Verification tokens are never exposed.
 */
publicStorefrontConfigRoutes.get('/support/connections', async (context) => {
  setPublicRuntimeHeaders(context);
  const connections = (await listCustomerServiceConnections(context.env.DB, 'active'))
    .filter((connection) => connection.isEnabled && !connection.deletedAt)
    .map(toPublicSupportConnection)
    .filter((connection): connection is PublicSupportConnection => Boolean(connection));
  return context.json({ connections });
});

/**
 * Resolve Product -> online support conversion group -> customer-service
 * connection + authoritative product demand context. Site does not select a
 * remote support group. Conversation/group/agent routing happens inside the
 * customer-service system. Runtime conversation traffic remains browser ->
 * customer-service directly.
 */
publicStorefrontConfigRoutes.get('/support/route/:productId', async (context) => {
  setPublicRuntimeHeaders(context);
  const productId = context.req.param('productId').trim();
  const requestedSectionId = context.req.query('sectionId')?.trim() ?? '';
  if (
    !validPublicId(productId) ||
    (requestedSectionId && !validPublicId(requestedSectionId))
  ) {
    return context.json({ available: false });
  }

  const product = await getRoutableProduct(context.env.DB, productId);
  if (
    !product ||
    (requestedSectionId && product.sectionId !== requestedSectionId) ||
    !product.conversionGroupId
  ) {
    return context.json({ available: false });
  }

  const group = await getConversionGroup(
    context.env.DB,
    product.sectionId,
    product.conversionGroupId,
  );
  if (
    !group ||
    group.deletedAt ||
    !group.isEnabled ||
    group.mode !== 'customer_service' ||
    !group.customerServiceConnectionId
  ) {
    return context.json({ available: false });
  }

  const connection = await getCustomerServiceConnection(
    context.env.DB,
    group.customerServiceConnectionId,
  );
  if (!connection || connection.deletedAt || !connection.isEnabled) {
    return context.json({ available: false });
  }
  const publicConnection = toPublicSupportConnection(connection);
  if (!publicConnection) return context.json({ available: false });

  return context.json({
    available: true,
    connection: publicConnection,
    product: {
      id: product.id,
      sectionId: product.sectionId,
      sectionName: product.sectionName,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      title: product.title,
    },
  });
});
