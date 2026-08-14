import { Hono, type Context } from 'hono';
import { getMediaBaseUrl } from '../assets/asset-library';
import { getConversionGroup } from '../conversion-pool/conversion-pool';
import { getRoutableProduct, resolvePublicCta } from '../conversion-pool/public-cta';
import {
  getCustomerServiceConnection,
  listCustomerServiceConnections,
  type CustomerServiceConnectionRecord,
} from '../customer-service/customer-service-connections';
import type { AppEnvironment } from '../types';

export const publicStorefrontConfigRoutes = new Hono<AppEnvironment>();

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

function publishedFile(reference: unknown, fileName: string): string | null {
  if (!isRecord(reference) || typeof reference.manifestKey !== 'string') return null;
  const manifestKey = reference.manifestKey;
  if (
    !/^public\/modules\/[A-Za-z0-9._/-]+\/manifest\.json$/u.test(manifestKey) ||
    manifestKey.includes('..')
  ) {
    return null;
  }
  return manifestKey.replace(/manifest\.json$/u, fileName);
}

function setPublicRuntimeHeaders(context: Context<AppEnvironment>) {
  context.header('Cache-Control', 'no-store');
  context.header('X-Robots-Tag', 'noindex, nofollow');
}

function toPublicSupportConnection(
  connection: CustomerServiceConnectionRecord,
): PublicSupportConnection | null {
  if (!connection.clientApiUrl || !connection.realtimeUrl || !connection.verifiedAt) {
    return null;
  }
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

publicStorefrontConfigRoutes.get('/content-origin', async (context) => {
  const contentOrigin = await getMediaBaseUrl(context.env.DB);
  setPublicRuntimeHeaders(context);
  return context.json({ contentOrigin });
});

publicStorefrontConfigRoutes.get('/media-base-url', async (context) => {
  const mediaBaseUrl = await getMediaBaseUrl(context.env.DB);
  setPublicRuntimeHeaders(context);
  return context.json({ mediaBaseUrl });
});

publicStorefrontConfigRoutes.get('/bootstrap', async (context) => {
  const [pointerValue, mediaBaseUrl] = await Promise.all([
    readPublishedJson(context.env.ASSETS_BUCKET, 'public/current.json'),
    getMediaBaseUrl(context.env.DB),
  ]);
  if (!isRecord(pointerValue) || pointerValue.schemaVersion !== 2) {
    return context.json({ available: false }, 404);
  }
  const sitePath = publishedFile(pointerValue.site, 'site.json');
  const sectionsPath = publishedFile(pointerValue.sectionsIndex, 'sections.json');
  const pointerVersion =
    typeof pointerValue.contentVersion === 'string' ? pointerValue.contentVersion : null;
  if (!sitePath || !sectionsPath || !pointerVersion) {
    return context.json({ available: false }, 404);
  }

  const [site, sectionsIndex, home] = await Promise.all([
    readPublishedJson(context.env.ASSETS_BUCKET, sitePath),
    readPublishedJson(context.env.ASSETS_BUCKET, sectionsPath),
    readPublishedJson(
      context.env.ASSETS_BUCKET,
      `public/home/${pointerVersion}/home.json`,
    ),
  ]);
  if (!site || !sectionsIndex || !home) {
    return context.json({ available: false }, 404);
  }

  context.header('Cache-Control', 'public, max-age=30, must-revalidate');
  context.header('X-Robots-Tag', 'noindex, nofollow');
  return context.json({
    pointer: pointerValue,
    site,
    sectionsIndex,
    home,
    mediaBaseUrl,
  });
});

publicStorefrontConfigRoutes.get('/cta/:productId', async (context) => {
  setPublicRuntimeHeaders(context);
  const productId = context.req.param('productId').trim();
  if (!validPublicId(productId)) {
    return context.json({ available: false });
  }
  const { cta } = await resolvePublicCta(context.env.DB, productId);
  return cta
    ? context.json({ available: true, ...cta })
    : context.json({ available: false });
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
