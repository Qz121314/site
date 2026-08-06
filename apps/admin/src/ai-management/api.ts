import { AdminApiError } from '../api';

export type AiSettings = {
  isEnabled: boolean;
  allowGuest: boolean;
  model: string;
  systemPrompt: string;
  dailyRequestLimit: number;
  perVisitorDailyLimit: number;
  maxInputCharacters: number;
  maxOutputTokens: number;
  temperature: number;
  updatedAt: string;
};

export type AiSettingsInput = Omit<AiSettings, 'updatedAt'>;

export type AiTestResult = {
  response: string;
  model: string;
  durationMs: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : null;
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);
  if (!response.ok) {
    const envelope = asRecord(body);
    const error = envelope ? asRecord(envelope.error) : null;
    throw new AdminApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'REQUEST_FAILED',
      typeof error?.message === 'string' ? error.message : 'AI 管理请求失败。',
    );
  }
  return body;
}

function adminJsonRequest(path: string, method: 'POST' | 'PUT', body: unknown) {
  return requestJson(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify(body),
  });
}

function parseSettings(value: unknown): AiSettings {
  const envelope = asRecord(value);
  const settings = envelope ? asRecord(envelope.settings) : null;
  const valid =
    settings &&
    typeof settings.isEnabled === 'boolean' &&
    typeof settings.allowGuest === 'boolean' &&
    typeof settings.model === 'string' &&
    typeof settings.systemPrompt === 'string' &&
    typeof settings.dailyRequestLimit === 'number' &&
    typeof settings.perVisitorDailyLimit === 'number' &&
    typeof settings.maxInputCharacters === 'number' &&
    typeof settings.maxOutputTokens === 'number' &&
    typeof settings.temperature === 'number' &&
    typeof settings.updatedAt === 'string';

  if (!valid) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'AI 设置返回数据无效。');
  }
  return settings as AiSettings;
}

function parseTestResult(value: unknown): AiTestResult {
  const result = asRecord(value);
  if (
    !result ||
    typeof result.response !== 'string' ||
    typeof result.model !== 'string' ||
    typeof result.durationMs !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'AI 测试返回数据无效。');
  }
  return result as AiTestResult;
}

export function fetchAiSettings(): Promise<AiSettings> {
  return requestJson('/api/admin/ai/').then(parseSettings);
}

export function updateAiSettings(input: AiSettingsInput): Promise<AiSettings> {
  return adminJsonRequest('/api/admin/ai/', 'PUT', input).then(parseSettings);
}

export function testAi(prompt: string): Promise<AiTestResult> {
  return adminJsonRequest('/api/admin/ai/test', 'POST', { prompt }).then(parseTestResult);
}
