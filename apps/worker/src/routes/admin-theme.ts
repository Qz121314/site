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
import { importThemeFromUrl, importThemeJson } from '../theme/theme-import';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  isRecord,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

export const adminThemeRoutes = new Hono<AppEnvironment>();

adminThemeRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  const settings = await getThemeSettings(context.env.DB);
  return context.json({
    theme: resolveTheme(settings),
    presets: THEME_PRESETS,
  });
});

adminThemeRoutes.post('/import', async (context) => {
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
  if (!isRecord(body) || (body.source !== 'url' && body.source !== 'json')) {
    return apiError(context, 400, 'THEME_IMPORT_REQUEST_INVALID', '主题导入参数无效。', {
      field: 'form',
    });
  }

  let result;
  if (body.source === 'url') {
    result = await importThemeFromUrl(body.url, body.mode);
  } else {
    if (typeof body.json !== 'string' || body.json.length > 256 * 1024) {
      return apiError(
        context,
        400,
        'THEME_IMPORT_JSON_INVALID',
        '主题 JSON 无效或超过 256 KB。',
        { field: 'json' },
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.json) as unknown;
    } catch {
      return apiError(context, 400, 'THEME_IMPORT_JSON_INVALID', '主题 JSON 解析失败。', {
        field: 'json',
      });
    }
    result = importThemeJson(parsed, body.mode);
  }

  if (!result.ok) {
    return apiError(context, 400, result.code, result.message, { field: result.field });
  }

  return context.json({
    theme: resolveTheme({
      key: 'custom',
      overrides: { imported: result.definition },
    }),
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
  const settings = {
    ...validation.settings,
    overrides: {
      ...validation.settings.overrides,
      ...(before.overrides.installPrompt
        ? { installPrompt: before.overrides.installPrompt }
        : {}),
    },
  };
  const updatedAt = new Date().toISOString();
  await context.env.DB.batch([
    createUpdateThemeStatement(context.env.DB, settings, updatedAt),
    createAuditLogStatement(context.env.DB, {
      action: 'theme.updated',
      entityType: 'site_theme',
      entityId: '1',
      requestId: context.get('requestId'),
      before,
      after: settings,
      createdAt: updatedAt,
    }),
  ]);

  return context.json({ theme: resolveTheme(settings) });
});
