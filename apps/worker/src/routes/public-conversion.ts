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

publicConversionRoutes.get('/message-card/:cardId', async (context) => {
  setRedirectHeaders(context);
  const cardId = context.req.param('cardId').trim();
  const card = await context.env.DB.prepare(
    `SELECT section_id, conversion_group_id
     FROM message_cta_cards
     WHERE id = ? AND is_enabled = 1 AND conversion_group_id IS NOT NULL`,
  )
    .bind(cardId)
    .first<{ section_id: string; conversion_group_id: string }>();
  if (!card?.section_id || !card.conversion_group_id) {
    return unavailable(context, 404, 'This contact option is unavailable.');
  }
  const group = await getConversionGroup(
    context.env.DB,
    card.section_id,
    card.conversion_group_id,
  );
  if (!group || group.deletedAt || !group.isEnabled || group.activeTargetCount < 1) {
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }
  if (group.mode === 'customer_service') {
    return context.redirect('/messages/new/', 302);
  }
  const target = await selectNextConversionTarget(
    context.env.DB,
    group,
    new Date().toISOString(),
  );
  if (!target?.endpointUrl)
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  return context.redirect(target.endpointUrl, 302);
});

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

  const landingSlug = context.req.query('landingSlug')?.trim() ?? '';
  if (landingSlug) {
    if (!/^[a-z0-9-]{1,120}$/u.test(landingSlug)) {
      return unavailable(context, 404, 'This landing page is unavailable.');
    }
    const landing = await context.env.DB.prepare(
      `SELECT product_id FROM landing_pages
       WHERE slug = ? AND status = 'published' AND deleted_at IS NULL`,
    )
      .bind(landingSlug)
      .first<{ product_id: string }>();
    if (!landing || landing.product_id !== product.id) {
      return unavailable(context, 404, 'This landing page is unavailable.');
    }
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
    if (landingSlug) query.set('landingSlug', landingSlug);
    const path = landingSlug
      ? `/l/${encodeURIComponent(landingSlug)}/chat/?${query.toString()}`
      : `/messages/new/?${query.toString()}`;
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
