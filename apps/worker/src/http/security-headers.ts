import type { MiddlewareHandler } from 'hono';
import type { AppEnvironment } from '../types';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
].join('; ');

export const securityHeaders: MiddlewareHandler<AppEnvironment> = async (context, next) => {
  await next();

  context.header('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  context.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()');
  context.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('X-Frame-Options', 'DENY');
};
