import { Hono } from 'hono';
import { apiError } from './http/api-response';
import { requireAdmin } from './middleware/require-admin';
import { adminAiRoutes } from './routes/admin-ai';
import { adminAssetRoutes } from './routes/admin-assets';
import { adminAuthRoutes } from './routes/admin-auth';
import { adminBrandingMediaRoutes } from './routes/admin-branding-media';
import { adminCategoryBatchRoutes } from './routes/admin-category-batch';
import { adminCategoryRoutes } from './routes/admin-categories';
import { adminConversionPoolRoutes } from './routes/admin-conversion-pool';
import { adminCustomerServiceRoutes } from './routes/admin-customer-service';
import { adminFaqRoutes } from './routes/admin-faqs';
import { adminProductBatchRoutes } from './routes/admin-product-batch';
import { adminProductRoutes } from './routes/admin-products';
import { adminSectionBatchRoutes } from './routes/admin-section-batch';
import { adminSectionRoutes } from './routes/admin-sections';
import { adminSiteSettingsRoutes } from './routes/admin-site-settings';
import { publicAiRoutes } from './routes/public-ai';
import type { AppEnvironment } from './types';

export const app = new Hono<AppEnvironment>({ strict: false });

app.use('*', async (context, next) => {
  const requestId = context.req.header('cf-ray') ?? crypto.randomUUID();
  const startedAt = Date.now();
  context.set('requestId', requestId);

  try {
    await next();
  } finally {
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
  }
});

app.get('/api/health', (context) =>
  context.json({
    ok: true,
    service: 'service-catalog-site',
    environment: context.env.ENVIRONMENT,
    version: context.env.APP_VERSION,
    publicLanguage: 'en',
    timestamp: new Date().toISOString(),
    requestId: context.get('requestId'),
  }),
);

app.get('/api/public/version', (context) =>
  context.json({
    appVersion: context.env.APP_VERSION,
    environment: context.env.ENVIRONMENT,
    publicLanguage: 'en',
  }),
);
app.route('/api/public/ai', publicAiRoutes);

app.route('/api/admin/auth', adminAuthRoutes);

app.use('/api/admin/*', requireAdmin);

app.get('/api/admin/health', (context) => {
  const session = context.get('adminSession');
  return context.json({
    ok: true,
    authenticated: true,
    expiresAt: new Date(session.expiresAt * 1000).toISOString(),
    requestId: context.get('requestId'),
  });
});

app.route('/api/admin/settings', adminSiteSettingsRoutes);
app.route('/api/admin/ai', adminAiRoutes);
app.route('/api/admin/customer-service', adminCustomerServiceRoutes);
app.route('/api/admin/assets', adminAssetRoutes);
app.route('/api/admin/media', adminBrandingMediaRoutes);
app.route('/api/admin/faqs', adminFaqRoutes);
app.route('/api/admin/sections', adminProductBatchRoutes);
app.route('/api/admin/sections', adminProductRoutes);
app.route('/api/admin/sections', adminConversionPoolRoutes);
app.route('/api/admin/sections', adminCategoryBatchRoutes);
app.route('/api/admin/sections', adminCategoryRoutes);
app.route('/api/admin/sections', adminSectionBatchRoutes);
app.route('/api/admin/sections', adminSectionRoutes);

app.get('/go/:code', (context) =>
  context.json(
    {
      error: {
        code: 'REDIRECT_NOT_CONFIGURED',
        message: 'Tracked redirects are not configured yet.',
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

  return apiError(context, 500, 'INTERNAL_ERROR', '服务器发生未预期错误。');
});

export default app;
