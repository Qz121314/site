import { Hono } from 'hono';
import {
  createUpdateAiSettingsStatement,
  getAiSettings,
  runAiText,
  toAiSettings,
  validateAiSettingsInput,
  type AiRunner,
} from '../ai/ai-settings';
import { createAuditLogStatement, writeAuditLog } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
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

function readPrompt(value: unknown, maximumLength: number): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prompt = (value as Record<string, unknown>).prompt;
  if (typeof prompt !== 'string') return null;
  const normalized = prompt.trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

export const adminAiRoutes = new Hono<AppEnvironment>();

adminAiRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ settings: await getAiSettings(context.env.DB) });
});

adminAiRoutes.put('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    const invalidContentType = error instanceof Error && error.message === 'INVALID_CONTENT_TYPE';
    return apiError(
      context,
      400,
      invalidContentType ? 'INVALID_CONTENT_TYPE' : 'INVALID_JSON',
      invalidContentType ? 'AI 设置请求必须使用 JSON。' : 'AI 设置请求 JSON 无效。',
    );
  }

  const validation = validateAiSettingsInput(body);
  if (!validation.ok) {
    return apiError(context, 400, 'INVALID_AI_SETTINGS', validation.message, {
      field: validation.field,
    });
  }

  const current = await getAiSettings(context.env.DB);
  const updatedAt = new Date().toISOString();
  const updated = toAiSettings(validation.value, updatedAt);
  await context.env.DB.batch([
    createUpdateAiSettingsStatement(context.env.DB, validation.value, updatedAt),
    createAuditLogStatement(context.env.DB, {
      action: 'ai_settings.updated',
      entityType: 'ai_settings',
      entityId: '1',
      requestId: context.get('requestId'),
      before: { ...current },
      after: { ...updated },
      createdAt: updatedAt,
    }),
  ]);

  return context.json({ settings: updated });
});

adminAiRoutes.post('/test', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    const invalidContentType = error instanceof Error && error.message === 'INVALID_CONTENT_TYPE';
    return apiError(
      context,
      400,
      invalidContentType ? 'INVALID_CONTENT_TYPE' : 'INVALID_JSON',
      invalidContentType ? 'AI 测试请求必须使用 JSON。' : 'AI 测试请求 JSON 无效。',
    );
  }

  const settings = await getAiSettings(context.env.DB);
  const prompt = readPrompt(body, Math.min(settings.maxInputCharacters, 2000));
  if (!prompt) {
    return apiError(
      context,
      400,
      'INVALID_AI_TEST_PROMPT',
      `测试内容不能为空，且不能超过 ${Math.min(settings.maxInputCharacters, 2000)} 个字符。`,
    );
  }

  const startedAt = Date.now();
  try {
    const response = await runAiText(context.env.AI as unknown as AiRunner, settings, prompt);
    const durationMs = Date.now() - startedAt;
    await writeAuditLog(context.env.DB, {
      action: 'ai_settings.tested',
      entityType: 'ai_settings',
      entityId: '1',
      requestId: context.get('requestId'),
      metadata: { model: settings.model, durationMs },
    });
    return context.json({ response, model: settings.model, durationMs });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'ai.test.failed',
        requestId: context.get('requestId'),
        model: settings.model,
        errorMessage: error instanceof Error ? error.message : 'UNKNOWN_AI_ERROR',
      }),
    );
    return apiError(
      context,
      503,
      'AI_INFERENCE_FAILED',
      'Workers AI 测试失败，请检查模型标识、账户额度和 AI Binding。',
      { model: settings.model },
    );
  }
});
