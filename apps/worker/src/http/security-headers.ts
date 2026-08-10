import type { MiddlewareHandler } from 'hono';
import securityHeaderValues from '../../../../config/security-headers.json' with { type: 'json' };
import type { AppEnvironment } from '../types';

export const securityHeaders: MiddlewareHandler<AppEnvironment> = async (
  context,
  next,
) => {
  await next();

  for (const [name, value] of Object.entries(securityHeaderValues)) {
    context.header(name, value);
  }
};
