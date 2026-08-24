import { Hono, type Context } from 'hono';
import {
  getConversionGroup,
  selectNextConversionTarget,
} from '../conversion-pool/conversion-pool';
import { getRoutableProduct } from '../conversion-pool/public-cta';
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

  if (group.mode === 'customer_service') {
    const handoffId = crypto.randomUUID();
    const query = new URLSearchParams({
      productId: product.id,
      sectionId: product.sectionId,
      handoffId,
    });
    const path = `/messages/new/?${query.toString()}`;
    if (context.req.header('accept')?.includes('application/json')) {
      return context.json({ path });
    }
    return context.redirect(path, 302);
  }

  // Link conversions are the only /go path that consumes Site round-robin.
  // Customer-service CTA only enters the Storefront Messages UI; Storefront
  // then resolves Product -> Support Group config and talks to support directly.
  const target = await selectNextConversionTarget(context.env.DB, group, now);
  if (!target || target.bindingKind !== 'link' || !target.endpointUrl) {
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }
  return context.redirect(target.endpointUrl, 302);
});
