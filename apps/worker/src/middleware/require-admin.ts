import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { getAdminAuthBindings } from '../auth/config';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '../auth/session';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';

export const requireAdmin: MiddlewareHandler<AppEnvironment> = async (context, next) => {
  context.header('Cache-Control', 'no-store');

  const authBindings = getAdminAuthBindings(context.env);
  if (!authBindings) {
    return apiError(context, 503, 'AUTH_NOT_CONFIGURED', '后台登录变量尚未配置。');
  }

  const token = getCookie(context, ADMIN_SESSION_COOKIE);
  if (!token) {
    return apiError(context, 401, 'AUTH_REQUIRED', '请先登录后台。');
  }

  const session = await verifyAdminSessionToken(token, authBindings.sessionSecret);
  if (!session) {
    return apiError(context, 401, 'SESSION_INVALID', '登录会话无效或已过期。');
  }

  context.set('adminSession', session);
  await next();
};
