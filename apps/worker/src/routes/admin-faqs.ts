import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  createDeleteFaqStatement,
  createFaq,
  createUpdateFaqStatement,
  getFaq,
  isFaqConflictError,
  listFaqs,
  validateFaqInput,
  type FaqRecord,
} from '../faqs/faqs';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

function faqNotFound(context: Parameters<typeof apiError>[0]) {
  return apiError(context, 404, 'FAQ_NOT_FOUND', 'FAQ 不存在。');
}

export const adminFaqRoutes = new Hono<AppEnvironment>();

adminFaqRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ faqs: await listFaqs(context.env.DB) });
});

adminFaqRoutes.post('/', async (context) => {
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

  const validation = validateFaqInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_FAQ', validation.message, {
      field: validation.field,
    });
  }

  const now = new Date().toISOString();
  const created = createFaq(context.env.DB, validation.value, now);

  try {
    await context.env.DB.batch([
      created.statement,
      createAuditLogStatement(context.env.DB, {
        action: 'faq.created',
        entityType: 'faq',
        entityId: created.faq.id,
        requestId: context.get('requestId'),
        after: { ...created.faq },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isFaqConflictError(error)) {
      return apiError(context, 409, 'FAQ_TITLE_CONFLICT', '已存在相同标题的 FAQ。');
    }
    throw error;
  }

  return context.json({ faq: created.faq }, 201);
});

adminFaqRoutes.put('/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const current = await getFaq(context.env.DB, context.req.param('id'));
  if (!current) return faqNotFound(context);

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }

  const validation = validateFaqInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_FAQ', validation.message, {
      field: validation.field,
    });
  }

  const now = new Date().toISOString();
  const updated: FaqRecord = {
    ...current,
    ...validation.value,
    updatedAt: now,
  };

  try {
    await context.env.DB.batch([
      createUpdateFaqStatement(context.env.DB, current.id, validation.value, now),
      createAuditLogStatement(context.env.DB, {
        action: 'faq.updated',
        entityType: 'faq',
        entityId: current.id,
        requestId: context.get('requestId'),
        before: { ...current },
        after: { ...updated },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isFaqConflictError(error)) {
      return apiError(context, 409, 'FAQ_TITLE_CONFLICT', '已存在相同标题的 FAQ。');
    }
    throw error;
  }

  return context.json({ faq: updated });
});

adminFaqRoutes.delete('/:id', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const current = await getFaq(context.env.DB, context.req.param('id'));
  if (!current) return faqNotFound(context);

  const now = new Date().toISOString();
  await context.env.DB.batch([
    createDeleteFaqStatement(context.env.DB, current.id),
    createAuditLogStatement(context.env.DB, {
      action: 'faq.deleted',
      entityType: 'faq',
      entityId: current.id,
      requestId: context.get('requestId'),
      before: { ...current },
      metadata: { physicalDelete: true },
      createdAt: now,
    }),
  ]);

  return context.json({ deletedId: current.id });
});
