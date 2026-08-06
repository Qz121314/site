import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { getAdminAuthSecrets } from '../auth/config';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '../auth/session';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';

export const requireAdmin: MiddlewareHandler<AppEnvironment> = async (context, next) => {
  context.header('Cache-Control', 'no-store');

  const secrets = getAdminAuthSecrets(context.env);
  if (!secrets) {
    return apiError(
      context,
      503,
      'AUTH_NOT_CONFIGURED',
      '后台登录 Secret 尚未正确配置。',
    );
  }

  const token = getCookie(context, ADMIN_SESSION_COOKIE);
  if (!token) {
    return apiError(context, 401, 'AUTH_REQUIRED', '请先登录后台。');
  }

  const session = await verifyAdminSessionToken(token, secrets.sessionSecret);
  if (!session) {
    return apiError(context, 401, 'SESSION_INVALID', '登录会话无效或已过期。');
  }

  context.set('adminSession', session);
  await next();
};
