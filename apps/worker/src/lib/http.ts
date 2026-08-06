import type { Context } from 'hono';
import type { AppEnvironment } from '../types';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export function errorResponse(
  context: Context<AppEnvironment>,
  status: 400 | 401 | 403 | 404 | 429 | 500,
  code: ErrorCode,
  message: string,
): Response {
  return context.json(
    {
      error: {
        code,
        message,
        requestId: context.get('requestId'),
      },
    },
    status,
  );
}

export function getClientIp(context: Context<AppEnvironment>): string {
  return (
    context.req.header('cf-connecting-ip') ??
    context.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export function isSameOriginRequest(context: Context<AppEnvironment>): boolean {
  const fetchSite = context.req.header('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    return false;
  }

  const origin = context.req.header('origin');
  if (!origin) {
    return true;
  }

  return origin === new URL(context.req.url).origin;
}
