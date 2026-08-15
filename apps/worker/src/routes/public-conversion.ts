import { Hono, type Context } from 'hono';
import {
  getConversionGroup,
  selectNextConversionTarget,
} from '../conversion-pool/conversion-pool';
import { getRoutableProduct } from '../conversion-pool/public-cta';
import { recordConversionTrafficEvent } from '../conversion-traffic/conversion-traffic';
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
  const now = new Date().toISOString();
  const requestId = context.get('requestId');

  if (!code || code.length > 100 || !/^[A-Za-z0-9-]+$/u.test(code)) {
    return unavailable(context, 404, 'This contact option is unavailable.');
  }

  const product = await getRoutableProduct(context.env.DB, code);
  if (!product) {
    return unavailable(context, 404, 'This contact option is unavailable.');
  }

  if (!product.conversionGroupId) {
    await recordConversionTrafficEvent(context.env.DB, {
      sectionId: product.sectionId,
      productId: product.id,
      conversionGroupId: null,
      conversionTargetId: null,
      mode: null,
      outcome: 'not_ready',
      requestId,
      createdAt: now,
    });
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }

  const group = await getConversionGroup(
    context.env.DB,
    product.sectionId,
    product.conversionGroupId,
  );
  if (!group || group.deletedAt || !group.isEnabled || group.activeTargetCount < 1) {
    await recordConversionTrafficEvent(context.env.DB, {
      sectionId: product.sectionId,
      productId: product.id,
      conversionGroupId: product.conversionGroupId,
      conversionTargetId: null,
      mode: group?.mode ?? null,
      outcome: 'not_ready',
      requestId,
      createdAt: now,
    });
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }

  if (group.mode === 'customer_service') {
    const handoffId = await recordConversionTrafficEvent(context.env.DB, {
      sectionId: product.sectionId,
      productId: product.id,
      conversionGroupId: group.id,
      conversionTargetId: null,
      mode: group.mode,
      outcome: 'redirected',
      requestId,
      createdAt: now,
    });
    const query = new URLSearchParams({
      productId: product.id,
      sectionId: product.sectionId,
      handoffId,
    });
    return context.redirect(`/messages/new/?${query.toString()}`, 302);
  }

  // Link conversions are the only /go path that consumes Site round-robin.
  // Customer-service CTA only enters the Storefront Messages UI; Storefront
  // then resolves Product -> Support Group config and talks to support directly.
  const target = await selectNextConversionTarget(context.env.DB, group, now);
  if (!target || target.bindingKind !== 'link' || !target.endpointUrl) {
    await recordConversionTrafficEvent(context.env.DB, {
      sectionId: product.sectionId,
      productId: product.id,
      conversionGroupId: group.id,
      conversionTargetId: target?.id ?? null,
      mode: group.mode,
      outcome: 'provider_error',
      requestId,
      createdAt: now,
    });
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }
  await recordConversionTrafficEvent(context.env.DB, {
    sectionId: product.sectionId,
    productId: product.id,
    conversionGroupId: group.id,
    conversionTargetId: target.id,
    mode: group.mode,
    outcome: 'redirected',
    requestId,
    createdAt: now,
  });
  return context.redirect(target.endpointUrl, 302);
});
