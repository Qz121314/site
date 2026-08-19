import { Hono, type Context } from 'hono';
import { getMediaBaseUrl } from '../assets/asset-library';
import { getConversionGroup } from '../conversion-pool/conversion-pool';
import { getRoutableProduct, resolvePublicCta } from '../conversion-pool/public-cta';
import {
  getCustomerServiceConnection,
  listCustomerServiceConnections,
  type CustomerServiceConnectionRecord,
} from '../customer-service/customer-service-connections';
import { buildMediaUrl } from '../media/media-url';
import { materializeDerivedSearchSnapshot } from '../publishing/storefront-publisher';
import { BOTTOM_NAVIGATION_KEYS } from '../settings/bottom-navigation';
import type { AppEnvironment } from '../types';

export const publicStorefrontConfigRoutes = new Hono<AppEnvironment>();

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

type PublicSupportConnection = {
  id: string;
  clientApiUrl: string;
  realtimeUrl: string;
  protocolVersion: 'v1';
};

type StorefrontRuntimeRow = {
  media_base_url: string | null;
  item_key: string;
  label: string;
  icon_type: string;
  icon_value: string | null;
  is_enabled: number;
  sort_order: number;
  icon_object_key: string | null;
};

type StorefrontBootstrapRuntime = {
  mediaBaseUrl: string | null;
  bottomNavigation: Array<{
    key: (typeof BOTTOM_NAVIGATION_KEYS)[number];
    label: string;
    enabled: boolean;
    icon: {
      type: 'builtin' | 'emoji' | 'image';
      value: string | null;
    };
  }>;
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

function validPointerVersion(value: string): boolean {
  return Boolean(value && value.length <= 180 && /^[A-Za-z0-9-]+$/u.test(value));
}

function searchSnapshotKey(pointerVersion: string): string {
  return `public/search/${encodeURIComponent(pointerVersion)}/search.json`;
}

export async function getStorefrontBootstrapRuntime(
  db: D1Database,
): Promise<StorefrontBootstrapRuntime | null> {
  const rows = (
    await db
      .prepare(
        `SELECT
           ss.media_base_url,
           nav.item_key,
           nav.label,
           nav.icon_type,
           nav.icon_value,
           nav.is_enabled,
           nav.sort_order,
           asset.object_key AS icon_object_key
         FROM site_settings ss
         CROSS JOIN site_bottom_navigation nav
         LEFT JOIN media_assets asset
           ON asset.id = nav.icon_asset_id
          AND asset.status = 'ready'
          AND asset.deleted_at IS NULL
          AND asset.media_kind IN ('image', 'animated_image')
         WHERE ss.id = 1
         ORDER BY nav.sort_order ASC, nav.item_key ASC`,
      )
      .all<StorefrontRuntimeRow>()
  ).results;

  if (rows.length !== BOTTOM_NAVIGATION_KEYS.length) return null;
  const byKey = new Map(rows.map((row) => [row.item_key, row]));
  const first = rows[0];
  if (!first) return null;
  const mediaBaseUrl = first.media_base_url;
  if (rows.some((row) => row.media_base_url !== mediaBaseUrl)) return null;

  const bottomNavigation: StorefrontBootstrapRuntime['bottomNavigation'] = [];
  for (const key of BOTTOM_NAVIGATION_KEYS) {
    const row = byKey.get(key);
    if (!row || typeof row.label !== 'string') return null;
    if (row.icon_type === 'builtin' || row.icon_type === 'emoji') {
      bottomNavigation.push({
        key,
        label: row.label,
        enabled: row.is_enabled === 1,
        icon: { type: row.icon_type, value: row.icon_value },
      });
      continue;
    }
    if (row.icon_type !== 'asset') return null;
    bottomNavigation.push({
      key,
      label: row.label,
      enabled: row.is_enabled === 1,
      icon: {
        type: 'image',
        value:
          mediaBaseUrl && row.icon_object_key
            ? buildMediaUrl(mediaBaseUrl, row.icon_object_key)
            : null,
      },
    });
  }

  return { mediaBaseUrl, bottomNavigation };
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
  const [pointerValue, runtime] = await Promise.all([
    readPublishedJson(context.env.ASSETS_BUCKET, 'public/current.json'),
    getStorefrontBootstrapRuntime(context.env.DB),
  ]);
  if (!isRecord(pointerValue) || pointerValue.schemaVersion !== 2 || !runtime) {
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
    mediaBaseUrl: runtime.mediaBaseUrl,
    bottomNavigation: runtime.bottomNavigation,
  });
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
