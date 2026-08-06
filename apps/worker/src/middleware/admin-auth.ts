import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Permission } from '../../../../packages/shared/src/domain';
import { errorResponse, isSameOriginRequest } from '../lib/http';
import { sha256Base64Url } from '../lib/crypto';
import { resolveAdminSession, touchAdminSession } from '../repositories/admin-auth';
import type { AppEnvironment } from '../types';

export const ADMIN_SESSION_COOKIE = 'site_admin_session';

export const requireSameOrigin: MiddlewareHandler<AppEnvironment> = async (context, next) => {
  if (!isSameOriginRequest(context)) {
    return errorResponse(context, 403, 'FORBIDDEN', 'Cross-site admin requests are not allowed.');
  }

  await next();
};

export const requireAdminSession: MiddlewareHandler<AppEnvironment> = async (context, next) => {
  const token = getCookie(context, ADMIN_SESSION_COOKIE);
  if (!token) {
    return errorResponse(context, 401, 'AUTH_REQUIRED', 'Administrator authentication is required.');
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenHash = await sha256Base64Url(token);
  const session = await resolveAdminSession(context.env.DB, tokenHash, now);
  if (!session) {
    return errorResponse(context, 401, 'AUTH_REQUIRED', 'The administrator session is invalid or expired.');
  }

  context.set('adminSession', session);
  if (now - session.lastSeenAt > 15 * 60) {
    await touchAdminSession(context.env.DB, session.sessionId, now);
  }

  await next();
};

export function requirePermission(permission: Permission): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    const session = context.get('adminSession');
    if (!session.permissions.includes(permission)) {
      return errorResponse(context, 403, 'FORBIDDEN', 'The administrator lacks the required permission.');
    }

    await next();
  };
}
