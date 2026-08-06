import { Hono } from 'hono';
import { getAiSettings, runAiText, type AiRunner } from '../ai/ai-settings';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';

type UsageCounts = {
  total_count: number;
  visitor_count: number;
};

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

async function hashIdentity(context: Parameters<typeof apiError>[0]): Promise<string> {
  const address = context.req.header('cf-connecting-ip') ?? 'unknown';
  const userAgent = (context.req.header('user-agent') ?? 'unknown').slice(0, 300);
  const bytes = new TextEncoder().encode(`${address}\n${userAgent}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('');
}

function nextUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function secondsUntilNextUtcDay(now: Date): number {
  return Math.max(1, Math.ceil((nextUtcDay(now).getTime() - now.getTime()) / 1000));
}

async function readUsageCounts(
  db: D1Database,
  usageDate: string,
  identityHash: string,
): Promise<{ total: number; visitor: number }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total_count,
              COALESCE(SUM(CASE WHEN identity_hash = ? THEN 1 ELSE 0 END), 0) AS visitor_count
       FROM ai_request_usage
       WHERE usage_date = ?`,
    )
    .bind(identityHash, usageDate)
    .first<UsageCounts>();
  return {
    total: Number(row?.total_count ?? 0),
    visitor: Number(row?.visitor_count ?? 0),
  };
}

async function reserveUsage(
  db: D1Database,
  usageDate: string,
  identityHash: string,
  dailyLimit: number,
  visitorLimit: number,
  createdAt: string,
): Promise<boolean> {
  const id = crypto.randomUUID();
  const row = await db
    .prepare(
      `INSERT INTO ai_request_usage (id, usage_date, identity_hash, created_at)
       SELECT ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM ai_request_usage WHERE usage_date = ?) < ?
         AND (
           SELECT COUNT(*)
           FROM ai_request_usage
           WHERE usage_date = ? AND identity_hash = ?
         ) < ?
       RETURNING id`,
    )
    .bind(
      id,
      usageDate,
      identityHash,
      createdAt,
      usageDate,
      dailyLimit,
      usageDate,
      identityHash,
      visitorLimit,
    )
    .first<{ id: string }>();
  return row?.id === id;
}

export const publicAiRoutes = new Hono<AppEnvironment>();

publicAiRoutes.post('/ask', async (context) => {
  context.header('Cache-Control', 'no-store');
  const settings = await getAiSettings(context.env.DB);
  if (!settings.isEnabled) {
    return apiError(context, 503, 'AI_DISABLED', 'AI 服务当前未启用。');
  }
  if (!settings.allowGuest) {
    return apiError(context, 403, 'AI_GUEST_ACCESS_DISABLED', 'AI 访客入口当前未开放。');
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
      invalidContentType ? 'AI 请求必须使用 JSON。' : 'AI 请求 JSON 无效。',
    );
  }

  const prompt = readPrompt(body, settings.maxInputCharacters);
  if (!prompt) {
    return apiError(
      context,
      400,
      'INVALID_AI_PROMPT',
      `问题不能为空，且不能超过 ${settings.maxInputCharacters} 个字符。`,
      { maxInputCharacters: settings.maxInputCharacters },
    );
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const usageDate = createdAt.slice(0, 10);
  const identityHash = await hashIdentity(context);
  const reserved = await reserveUsage(
    context.env.DB,
    usageDate,
    identityHash,
    settings.dailyRequestLimit,
    settings.perVisitorDailyLimit,
    createdAt,
  );

  if (!reserved) {
    const counts = await readUsageCounts(context.env.DB, usageDate, identityHash);
    const retryAfterSeconds = secondsUntilNextUtcDay(now);
    context.header('Retry-After', String(retryAfterSeconds));
    if (counts.total >= settings.dailyRequestLimit) {
      return apiError(
        context,
        429,
        'AI_DAILY_LIMIT_REACHED',
        'AI 今日全站额度已用完，请明天再试。',
        { retryAfterSeconds, dailyRequestLimit: settings.dailyRequestLimit },
      );
    }
    return apiError(
      context,
      429,
      'AI_VISITOR_LIMIT_REACHED',
      '你今天的 AI 使用次数已达上限，请明天再试。',
      { retryAfterSeconds, perVisitorDailyLimit: settings.perVisitorDailyLimit },
    );
  }

  try {
    const response = await runAiText(context.env.AI as unknown as AiRunner, settings, prompt);
    const counts = await readUsageCounts(context.env.DB, usageDate, identityHash);
    const remainingToday = Math.max(0, settings.dailyRequestLimit - counts.total);
    const remainingForVisitor = Math.max(0, settings.perVisitorDailyLimit - counts.visitor);
    context.header('X-RateLimit-Remaining', String(remainingForVisitor));
    return context.json({
      response,
      limits: {
        remainingToday,
        remainingForVisitor,
        resetsAt: nextUtcDay(now).toISOString(),
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'ai.public.failed',
        requestId: context.get('requestId'),
        model: settings.model,
        errorMessage: error instanceof Error ? error.message : 'UNKNOWN_AI_ERROR',
      }),
    );
    return apiError(
      context,
      503,
      'AI_INFERENCE_FAILED',
      'AI 服务暂时不可用，请稍后再试。',
    );
  }
});
