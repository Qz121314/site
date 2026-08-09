import { Hono } from 'hono';
import { getMediaBaseUrl } from '../assets/asset-library';
import {
  getConversionGroup,
  listConversionTargets,
} from '../conversion-pool/conversion-pool';
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
  baseUrl: string;
  projectId: string | null;
  protocolVersion: 'v1';
};

function setPublicRuntimeHeaders(context: Parameters<typeof getMediaBaseUrl>[0] extends never ? never : any) {
  context.header('Cache-Control', 'no-store');
  context.header('X-Robots-Tag', 'noindex, nofollow');
}

function toPublicSupportConnection(
  connection: CustomerServiceConnectionRecord,
): PublicSupportConnection {
  return {
    id: connection.id,
    baseUrl: connection.baseUrl,
    projectId: connection.projectId,
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
 * Public discovery only. Storefront uses these non-secret values to connect
 * directly to the independent customer-service system. Management tokens are
 * never returned from this endpoint.
 */
publicStorefrontConfigRoutes.get('/support/connections', async (context) => {
  setPublicRuntimeHeaders(context);
  const connections = (await listCustomerServiceConnections(context.env.DB, 'active'))
    .filter((connection) => connection.isEnabled && !connection.deletedAt)
    .map(toPublicSupportConnection);
  return context.json({ connections });
});

/**
 * Resolve Product -> customer-service connection -> remote support group.
 * This is configuration discovery only: it does not create a conversation,
 * send a message, call the support provider, or advance a round-robin cursor.
 */
publicStorefrontConfigRoutes.get('/support/route/:productId', async (context) => {
  setPublicRuntimeHeaders(context);
  const productId = context.req.param('productId').trim();
  const requestedSectionId = context.req.query('sectionId')?.trim() ?? '';
  if (!validPublicId(productId) || (requestedSectionId && !validPublicId(requestedSectionId))) {
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
    group.activeTargetCount < 1
  ) {
    return context.json({ available: false });
  }

  const targets = await listConversionTargets(
    context.env.DB,
    product.sectionId,
    group.id,
    'active',
  );
  for (const target of targets) {
    if (
      !target.isEnabled ||
      target.bindingKind !== 'customer_service' ||
      !target.customerServiceConnectionId ||
      !target.remoteGroupId
    ) {
      continue;
    }
    const connection = await getCustomerServiceConnection(
      context.env.DB,
      target.customerServiceConnectionId,
    );
    if (!connection || connection.deletedAt || !connection.isEnabled) continue;

    return context.json({
      available: true,
      connection: toPublicSupportConnection(connection),
      groupId: target.remoteGroupId,
    });
  }

  return context.json({ available: false });
});
