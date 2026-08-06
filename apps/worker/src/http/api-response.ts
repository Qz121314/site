import type { Context } from 'hono';
import type { AppEnvironment } from '../types';

type ApiErrorStatus = 400 | 401 | 403 | 429 | 500 | 503;

type ApiErrorDetails = Record<string, string | number | boolean>;

export function apiError(
  context: Context<AppEnvironment>,
  status: ApiErrorStatus,
  code: string,
  message: string,
  details?: ApiErrorDetails,
) {
  return context.json(
    {
      error: {
        code,
        message,
        requestId: context.get('requestId'),
        ...(details ? { details } : {}),
      },
    },
    status,
  );
}
