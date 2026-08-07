import { Hono } from 'hono';
import { recordConversionEvent, type ConversionEventInput } from '../conversion/conversion-events';
import { getConversionGroup, selectNextConversionTarget } from '../conversion-pool/conversion-pool';
import { getCustomerServiceConnectionInternal } from '../customer-service/customer-service-connections';
import {
  CustomerServiceProviderError,
  resolveCustomerServiceGroupEntry,
} from '../customer-service/customer-service-provider';
import type { AppEnvironment } from '../types';

type RoutableProductRow = {
  id: string;
  section_id: string;
  conversion_group_id: string | null;
};

function setRedirectHeaders(context: Parameters<typeof unavailable>[0]) {
  context.header('Cache-Control', 'no-store, private');
  context.header('Pragma', 'no-cache');
  context.header('Referrer-Policy', 'no-referrer');
  context.header('X-Robots-Tag', 'noindex, nofollow');
}

function unavailable(
  context: import('hono').Context<AppEnvironment>,
  status: 404 | 409 | 502 | 503,
  message: string,
) {
  setRedirectHeaders(context);
  return context.text(message, status);
}

async function getRoutableProduct(db: D1Database, productId: string): Promise<RoutableProductRow | null> {
  return db
    .prepare(
      `SELECT p.id, p.section_id, p.conversion_group_id
       FROM products p
       JOIN sections s ON s.id = p.section_id
       WHERE p.id = ?
         AND p.deleted_at IS NULL
         AND p.status = 'published'
         AND s.deleted_at IS NULL
         AND s.is_enabled = 1`,
    )
    .bind(productId)
    .first<RoutableProductRow>();
}

async function safeRecordEvent(db: D1Database, input: ConversionEventInput): Promise<void> {
  try {
    await recordConversionEvent(db, input);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'conversion.event_write_failed',
        requestId: input.requestId,
        productId: input.productId,
        conversionGroupId: input.conversionGroupId,
        conversionTargetId: input.conversionTargetId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown conversion event write failure',
      }),
    );
  }
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

  if (!product.conversion_group_id) {
    await safeRecordEvent(context.env.DB, {
      sectionId: product.section_id,
      productId: product.id,
      conversionGroupId: null,
      conversionTargetId: null,
      mode: null,
      outcome: 'not_ready',
      requestId,
      metadata: { reason: 'conversion_group_missing' },
      createdAt: now,
    });
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }

  const group = await getConversionGroup(
    context.env.DB,
    product.section_id,
    product.conversion_group_id,
  );
  if (!group || group.deletedAt || !group.isEnabled || group.activeTargetCount < 1) {
    await safeRecordEvent(context.env.DB, {
      sectionId: product.section_id,
      productId: product.id,
      conversionGroupId: product.conversion_group_id,
      conversionTargetId: null,
      mode: group?.mode ?? null,
      outcome: 'not_ready',
      requestId,
      metadata: { reason: 'conversion_group_not_ready' },
      createdAt: now,
    });
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }

  // This is the only public path that consumes the production round-robin cursor.
  // The selector advances the D1 cursor atomically before resolving the target.
  const target = await selectNextConversionTarget(context.env.DB, group, now);
  if (!target) {
    await safeRecordEvent(context.env.DB, {
      sectionId: product.section_id,
      productId: product.id,
      conversionGroupId: group.id,
      conversionTargetId: null,
      mode: group.mode,
      outcome: 'not_ready',
      requestId,
      metadata: { reason: 'conversion_target_missing_after_rotation' },
      createdAt: now,
    });
    return unavailable(context, 409, 'This contact option is temporarily unavailable.');
  }

  if (group.mode === 'link') {
    if (target.bindingKind !== 'link' || !target.endpointUrl) {
      await safeRecordEvent(context.env.DB, {
        sectionId: product.section_id,
        productId: product.id,
        conversionGroupId: group.id,
        conversionTargetId: target.id,
        mode: group.mode,
        outcome: 'not_ready',
        requestId,
        metadata: { reason: 'link_target_invalid' },
        createdAt: now,
      });
      return unavailable(context, 409, 'This contact option is temporarily unavailable.');
    }

    await safeRecordEvent(context.env.DB, {
      sectionId: product.section_id,
      productId: product.id,
      conversionGroupId: group.id,
      conversionTargetId: target.id,
      mode: group.mode,
      outcome: 'redirected',
      requestId,
      metadata: { targetName: target.name },
      createdAt: now,
    });
    return context.redirect(target.endpointUrl, 302);
  }

  if (
    target.bindingKind !== 'customer_service' ||
    !target.customerServiceConnectionId ||
    !target.remoteGroupId
  ) {
    await safeRecordEvent(context.env.DB, {
      sectionId: product.section_id,
      productId: product.id,
      conversionGroupId: group.id,
      conversionTargetId: target.id,
      mode: group.mode,
      outcome: 'not_ready',
      requestId,
      metadata: { reason: 'customer_service_target_invalid' },
      createdAt: now,
    });
    return unavailable(context, 409, 'Customer service is temporarily unavailable.');
  }

  const connection = await getCustomerServiceConnectionInternal(
    context.env.DB,
    target.customerServiceConnectionId,
  );
  if (!connection || connection.deletedAt || !connection.isEnabled) {
    await safeRecordEvent(context.env.DB, {
      sectionId: product.section_id,
      productId: product.id,
      conversionGroupId: group.id,
      conversionTargetId: target.id,
      mode: group.mode,
      outcome: 'provider_error',
      requestId,
      metadata: { reason: 'customer_service_connection_unavailable' },
      createdAt: now,
    });
    return unavailable(context, 503, 'Customer service is temporarily unavailable.');
  }

  try {
    const entry = await resolveCustomerServiceGroupEntry(connection, target.remoteGroupId, {
      requestId,
      productId: product.id,
      sectionId: product.section_id,
    });
    await safeRecordEvent(context.env.DB, {
      sectionId: product.section_id,
      productId: product.id,
      conversionGroupId: group.id,
      conversionTargetId: target.id,
      mode: group.mode,
      outcome: 'redirected',
      requestId,
      metadata: {
        customerServiceConnectionId: connection.id,
        remoteGroupId: target.remoteGroupId,
        remoteGroupName: target.remoteGroupName,
      },
      createdAt: now,
    });
    return context.redirect(entry.url, 302);
  } catch (error) {
    const providerCode =
      error instanceof CustomerServiceProviderError ? error.code : 'CUSTOMER_SERVICE_UNKNOWN_ERROR';
    await safeRecordEvent(context.env.DB, {
      sectionId: product.section_id,
      productId: product.id,
      conversionGroupId: group.id,
      conversionTargetId: target.id,
      mode: group.mode,
      outcome: 'provider_error',
      requestId,
      metadata: {
        providerCode,
        customerServiceConnectionId: connection.id,
        remoteGroupId: target.remoteGroupId,
      },
      createdAt: now,
    });
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
