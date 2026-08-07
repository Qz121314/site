import { Hono, type Context } from 'hono';
import { getConversionGroup, selectNextConversionTarget } from '../conversion-pool/conversion-pool';
import { getRoutableProduct } from '../conversion-pool/public-cta';
import { getCustomerServiceConnectionInternal } from '../customer-service/customer-service-connections';
import {
  CustomerServiceProviderError,
  resolveCustomerServiceGroupEntry,
} from '../customer-service/customer-service-provider';
import type { AppEnvironment } from '../types';

function setRedirectHeaders(context: Context<AppEnvironment>) {
  context.header('Cache-Control', 'no-store, private');
  context.header('Pragma', 'no-cache');
  context.header('Referrer-Policy', 'no-referrer');
  context.header('X-Robots-Tag', 'noindex, nofollow');
}

function unavailable(
  context: Context<AppEnvironment>,
  status: 404 | 409 | 502 | 503,
  message: string,
) {
  setRedirectHeaders(context);
  return context.text(message, status);
}

export const publicConversionRoutes = new Hono<AppEnvironment>();

publicConversionRoutes.get('/:code', async (context) => {
  setRedirectHeaders(context);
  const code = context.req.param('code').trim();
  const requestId = context.get('requestId');
  const now = new Date().toISOString();

  if (!code || code.length > 100 || !/^[A-Za-z0-9-]+$/u.test(code)) {
    return unavailable(context, 404, 'This contact option is unavailable.');
  }

  const product = await getRoutableProduct(context.env.DB, code);
  if (!product) {
    return unavailable(context, 404, 'This contact option is unavailable.');
  }

  if (!product.conversionGroupId) {
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }

  const group = await getConversionGroup(
    context.env.DB,
    product.sectionId,
    product.conversionGroupId,
  );
  if (!group || group.deletedAt || !group.isEnabled || group.activeTargetCount < 1) {
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }

  // This is the only public path that consumes the production round-robin cursor.
  // The selector advances the D1 cursor atomically before resolving the target.
  const target = await selectNextConversionTarget(context.env.DB, group, now);
  if (!target) {
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }

  if (group.mode === 'link') {
    if (target.bindingKind !== 'link' || !target.endpointUrl) {
      return unavailable(context, 409, 'This contact option is temporarily unavailable.');
    }
    return context.redirect(target.endpointUrl, 302);
  }

  if (
    target.bindingKind !== 'customer_service' ||
    !target.customerServiceConnectionId ||
    !target.remoteGroupId
  ) {
    return unavailable(context, 409, 'Customer service is temporarily unavailable.');
  }

  const connection = await getCustomerServiceConnectionInternal(
    context.env.DB,
    target.customerServiceConnectionId,
  );
  if (!connection || connection.deletedAt || !connection.isEnabled) {
    return unavailable(context, 503, 'Customer service is temporarily unavailable.');
  }

  try {
    const entry = await resolveCustomerServiceGroupEntry(connection, target.remoteGroupId, {
      requestId,
      productId: product.id,
      sectionId: product.sectionId,
    });
    return context.redirect(entry.url, 302);
  } catch (error) {
    const providerCode =
      error instanceof CustomerServiceProviderError ? error.code : 'CUSTOMER_SERVICE_UNKNOWN_ERROR';
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'conversion.customer_service_failed',
        requestId,
        productId: product.id,
        conversionGroupId: group.id,
        conversionTargetId: target.id,
        providerCode,
      }),
    );
    return unavailable(context, 502, 'Customer service is temporarily unavailable.');
  }
});
