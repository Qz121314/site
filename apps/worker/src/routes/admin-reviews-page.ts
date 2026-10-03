import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  getReviewsPage,
  upsertReviewsPageStatement,
  validateReviewsPageInput,
} from '../reviews/reviews-page';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

export const adminReviewsPageRoutes = new Hono<AppEnvironment>();

adminReviewsPageRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ page: await getReviewsPage(context.env.DB) });
});

adminReviewsPageRoutes.put('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const validation = validateReviewsPageInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_REVIEWS_PAGE', validation.message, {
      field: validation.field,
    });
  }

  const before = await getReviewsPage(context.env.DB);
  const updatedAt = new Date().toISOString();
  const after = { ...validation.value, updatedAt };
  await context.env.DB.batch([
    upsertReviewsPageStatement(context.env.DB, validation.value, updatedAt),
    createAuditLogStatement(context.env.DB, {
      action: before ? 'reviews_page.updated' : 'reviews_page.created',
      entityType: 'reviews_page',
      entityId: '1',
      requestId: context.get('requestId'),
      ...(before ? { before } : {}),
      after,
      createdAt: updatedAt,
    }),
  ]);
  return context.json({ page: after });
});
