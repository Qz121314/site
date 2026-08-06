import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  createUpdateCustomerServiceSettingsStatement,
  getCustomerServiceSettings,
  toCustomerServiceSettings,
  validateCustomerServiceSettingsInput,
} from '../settings/customer-service-settings';
import type { AppEnvironment } from '../types';

const ADMIN_REQUEST_HEADER = 'x-admin-request';

function hasAdminRequestHeader(context: Parameters<typeof apiError>[0]): boolean {
  return context.req.header(ADMIN_REQUEST_HEADER) === '1';
}

async function readJsonBody(context: Parameters<typeof apiError>[0]): Promise<unknown> {
  const contentType = context.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new Error('INVALID_CONTENT_TYPE');
  }

  try {
    return await context.req.json<unknown>();
  } catch {
    throw new Error('INVALID_JSON');
  }
}

export const adminCustomerServiceRoutes = new Hono<AppEnvironment>();

adminCustomerServiceRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  const settings = await getCustomerServiceSettings(context.env.DB);
  return context.json({ settings });
});

adminCustomerServiceRoutes.put('/', async (context) => {
  context.header('Cache-Control', 'no-store');

  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    const invalidContentType =
      error instanceof Error && error.message === 'INVALID_CONTENT_TYPE';
    return apiError(
      context,
      400,
      invalidContentType ? 'INVALID_CONTENT_TYPE' : 'INVALID_JSON',
      invalidContentType ? '客服设置请求必须使用 JSON。' : '客服设置请求 JSON 无效。',
    );
  }

  const validation = validateCustomerServiceSettingsInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_CUSTOMER_SERVICE_SETTINGS', validation.message, {
      field: validation.field,
    });
  }

  const current = await getCustomerServiceSettings(context.env.DB);
  const updatedAt = new Date().toISOString();
  const updated = toCustomerServiceSettings(validation.value, updatedAt);

  await context.env.DB.batch([
    createUpdateCustomerServiceSettingsStatement(context.env.DB, validation.value, updatedAt),
    createAuditLogStatement(context.env.DB, {
      action: 'customer_service_settings.updated',
      entityType: 'customer_service_settings',
      entityId: '1',
      requestId: context.get('requestId'),
      before: { ...current },
      after: { ...updated },
      createdAt: updatedAt,
    }),
  ]);

  return context.json({ settings: updated });
});
