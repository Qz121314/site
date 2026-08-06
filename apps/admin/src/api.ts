export type AdminSessionResponse = {
  authenticated: boolean;
  expiresAt?: string;
};

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: {
      retryAfterSeconds?: number;
    };
  };
};

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code: string, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json() as Promise<unknown>;
}

function asErrorEnvelope(value: unknown): ApiErrorEnvelope {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as ApiErrorEnvelope;
}

async function requestSession(
  path: string,
  init?: RequestInit,
): Promise<AdminSessionResponse> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);

  if (!response.ok) {
    const envelope = asErrorEnvelope(body);
    throw new AdminApiError(
      response.status,
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? '后台请求失败。',
      envelope.error?.details?.retryAfterSeconds,
    );
  }

  if (!body || typeof body !== 'object') {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '后台返回了无效数据。');
  }

  const result = body as Record<string, unknown>;
  return {
    authenticated: result.authenticated === true,
    ...(typeof result.expiresAt === 'string' ? { expiresAt: result.expiresAt } : {}),
  };
}

export function fetchAdminSession(): Promise<AdminSessionResponse> {
  return requestSession('/api/admin/auth/session');
}

export function loginAdmin(password: string): Promise<AdminSessionResponse> {
  return requestSession('/api/admin/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({ password }),
  });
}

export async function logoutAdmin(): Promise<void> {
  const response = await fetch('/api/admin/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'x-admin-request': '1',
    },
  });

  if (response.status === 204) {
    return;
  }

  const body = await readJson(response);
  const envelope = asErrorEnvelope(body);
  throw new AdminApiError(
    response.status,
    envelope.error?.code ?? 'LOGOUT_FAILED',
    envelope.error?.message ?? '退出登录失败。',
  );
}
