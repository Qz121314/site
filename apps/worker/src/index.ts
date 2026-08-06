import { Hono } from 'hono';

type Variables = {
  requestId: string;
};

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', async (context, next) => {
  const requestId = context.req.header('cf-ray') ?? crypto.randomUUID();
  const startedAt = Date.now();
  context.set('requestId', requestId);

  await next();

  context.header('x-request-id', requestId);
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'request.complete',
      requestId,
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    }),
  );
});

app.get('/', (context) => {
  const preferredLanguage = context.req.header('accept-language')?.toLowerCase() ?? '';
  context.header('vary', 'Accept-Language');
  context.header('cache-control', 'private, no-store');
  return context.redirect(preferredLanguage.includes('es') ? '/es/' : '/en/', 302);
});

app.get('/api/health', (context) =>
  context.json({
    ok: true,
    service: 'service-catalog-site',
    environment: context.env.ENVIRONMENT,
    version: context.env.APP_VERSION,
    timestamp: new Date().toISOString(),
    requestId: context.get('requestId'),
  }),
);

app.get('/api/public/version', (context) =>
  context.json({
    appVersion: context.env.APP_VERSION,
    environment: context.env.ENVIRONMENT,
  }),
);

app.get('/go/:code', (context) =>
  context.json(
    {
      error: {
        code: 'REDIRECT_NOT_CONFIGURED',
        message: 'Tracked redirects will be enabled in the conversion phase.',
        requestId: context.get('requestId'),
      },
    },
    501,
  ),
);

app.notFound((context) => {
  if (context.req.path.startsWith('/api/')) {
    return context.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'The requested API route does not exist.',
          requestId: context.get('requestId'),
        },
      },
      404,
    );
  }

  return context.text('Not Found', 404);
});

app.onError((error, context) => {
  const requestId = context.get('requestId') ?? crypto.randomUUID();
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'request.failed',
      requestId,
      path: context.req.path,
      errorName: error.name,
      errorMessage: error.message,
    }),
  );

  return context.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.',
        requestId,
      },
    },
    500,
  );
});

export default app;
