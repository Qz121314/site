import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import {
  THEME_PRESETS,
  createUpdateThemeStatement,
  getThemeSettings,
  resolveTheme,
  validateThemeUpdate,
} from '../theme/theme-center';
import type { AppEnvironment } from '../types';
import { hasAdminRequestHeader, jsonBodyError, readJsonBody } from './admin-section-shared';

export const adminThemeRoutes = new Hono<AppEnvironment>();

adminThemeRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  const settings = await getThemeSettings(context.env.DB);
  return context.json({
    theme: resolveTheme(settings),
    presets: THEME_PRESETS,
  });
});

adminThemeRoutes.put('/', async (context) => {
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

  const validation = validateThemeUpdate(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_THEME_SETTINGS', validation.message, {
      field: validation.field,
    });
  }

  const before = await getThemeSettings(context.env.DB);
  const updatedAt = new Date().toISOString();
  await context.env.DB.batch([
    createUpdateThemeStatement(context.env.DB, validation.settings, updatedAt),
    createAuditLogStatement(context.env.DB, {
      action: 'theme.updated',
      entityType: 'site_theme',
      entityId: '1',
      requestId: context.get('requestId'),
      before,
      after: validation.settings,
      createdAt: updatedAt,
    }),
  ]);

  return context.json({ theme: resolveTheme(validation.settings) });
});
