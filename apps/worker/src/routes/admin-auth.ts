import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { writeAuditLog } from '../audit/write-audit-log';
import { getAdminAuthSecrets } from '../auth/config';
import { constantTimeSecretEqual } from '../auth/crypto';
import {
  clearLoginRateLimit,
  createLoginRateLimitKey,
  getLoginRateLimitStatus,
  pruneExpiredLoginRateLimits,
  recordFailedLogin,
} from '../auth/rate-limit';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '../auth/session';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';

const ADMIN_REQUEST_HEADER = 'x-admin-request';

type LoginBody = {
  password: string;
};

function isLoginBody(value: unknown): value is LoginBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const password = (value as Record<string, unknown>).password;
  return typeof password === 'string' && password.length > 0 && password.length <= 512;
}

function hasAdminRequestHeader(context: Parameters<typeof apiError>[0]): boolean {
  return context.req.header(ADMIN_REQUEST_HEADER) === '1';
}

function sessionCookieOptions(context: Parameters<typeof apiError>[0]) {
  return {
    path: '/',
    httpOnly: true,
    secure: new URL(context.req.url).protocol === 'https:',
    sameSite: 'Strict' as const,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  };
}

export const adminAuthRoutes = new Hono<AppEnvironment>();

adminAuthRoutes.get('/session', async (context) => {
  context.header('Cache-Control', 'no-store');

  const secrets = getAdminAuthSecrets(context.env);
  if (!secrets) {
    return apiError(
      context,
      503,
      'AUTH_NOT_CONFIGURED',
      '请在 Cloudflare Worker Secrets 中配置 ADMIN_PASSWORD 和 SESSION_SECRET。',
    );
  }

  const token = getCookie(context, ADMIN_SESSION_COOKIE);
  if (!token) {
    return context.json({ authenticated: false });
  }

  const session = await verifyAdminSessionToken(token, secrets.sessionSecret);
  if (!session) {
    deleteCookie(context, ADMIN_SESSION_COOKIE, { path: '/' });
    return context.json({ authenticated: false });
  }

  return context.json({
    authenticated: true,
    expiresAt: new Date(session.expiresAt * 1000).toISOString(),
  });
});

adminAuthRoutes.post('/login', async (context) => {
  context.header('Cache-Control', 'no-store');

  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const secrets = getAdminAuthSecrets(context.env);
  if (!secrets) {
    return apiError(
      context,
      503,
      'AUTH_NOT_CONFIGURED',
      '请在 Cloudflare Worker Secrets 中配置 ADMIN_PASSWORD 和 SESSION_SECRET。',
    );
  }

  const contentType = context.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return apiError(context, 400, 'INVALID_CONTENT_TYPE', '登录请求必须使用 JSON。');
  }

  let body: unknown;
  try {
    body = await context.req.json<unknown>();
  } catch {
    return apiError(context, 400, 'INVALID_JSON', '登录请求 JSON 无效。');
  }

  if (!isLoginBody(body)) {
    return apiError(context, 400, 'INVALID_PASSWORD_INPUT', '请输入有效的后台密码。');
  }

  const now = new Date();
  const clientAddress = context.req.header('cf-connecting-ip') ?? 'unknown';
  const keyHash = await createLoginRateLimitKey(clientAddress, secrets.sessionSecret);

  await pruneExpiredLoginRateLimits(context.env.DB, now);
  const currentLimit = await getLoginRateLimitStatus(context.env.DB, keyHash, now);
  if (currentLimit.blocked) {
    context.header('Retry-After', String(currentLimit.retryAfterSeconds));
    await writeAuditLog(context.env.DB, {
      action: 'auth.login.blocked',
      entityType: 'admin_auth',
      requestId: context.get('requestId'),
      metadata: { retryAfterSeconds: currentLimit.retryAfterSeconds },
    });
    return apiError(
      context,
      429,
      'LOGIN_RATE_LIMITED',
      '登录尝试过多，请稍后再试。',
      { retryAfterSeconds: currentLimit.retryAfterSeconds },
    );
  }

  const passwordMatches = await constantTimeSecretEqual(body.password, secrets.adminPassword);
  if (!passwordMatches) {
    const updatedLimit = await recordFailedLogin(context.env.DB, keyHash, now);
    await writeAuditLog(context.env.DB, {
      action: 'auth.login.failed',
      entityType: 'admin_auth',
      requestId: context.get('requestId'),
      metadata: { rateLimited: updatedLimit.blocked },
    });

    if (updatedLimit.blocked) {
      context.header('Retry-After', String(updatedLimit.retryAfterSeconds));
      return apiError(
        context,
        429,
        'LOGIN_RATE_LIMITED',
        '登录尝试过多，请稍后再试。',
        { retryAfterSeconds: updatedLimit.retryAfterSeconds },
      );
    }

    return apiError(context, 401, 'INVALID_CREDENTIALS', '后台密码不正确。');
  }

  const { token, session } = await createAdminSessionToken(secrets.sessionSecret, now.getTime());
  await clearLoginRateLimit(context.env.DB, keyHash);
  await writeAuditLog(context.env.DB, {
    action: 'auth.login.succeeded',
    entityType: 'admin_auth',
    requestId: context.get('requestId'),
  });

  setCookie(context, ADMIN_SESSION_COOKIE, token, sessionCookieOptions(context));

  return context.json({
    authenticated: true,
    expiresAt: new Date(session.expiresAt * 1000).toISOString(),
  });
});

adminAuthRoutes.post('/logout', async (context) => {
  context.header('Cache-Control', 'no-store');

  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  const secrets = getAdminAuthSecrets(context.env);
  const token = getCookie(context, ADMIN_SESSION_COOKIE);
  if (secrets && token) {
    const session = await verifyAdminSessionToken(token, secrets.sessionSecret);
    if (session) {
      await writeAuditLog(context.env.DB, {
        action: 'auth.logout',
        entityType: 'admin_auth',
        requestId: context.get('requestId'),
      });
    }
  }

  deleteCookie(context, ADMIN_SESSION_COOKIE, { path: '/' });
  return context.body(null, 204);
});
