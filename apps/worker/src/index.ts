import { Hono } from 'hono';
import { apiError } from './http/api-response';
import { securityHeaders } from './http/security-headers';
import { requireAdmin } from './middleware/require-admin';
import { adminAssetRoutes } from './routes/admin-assets';
import { adminAuthRoutes } from './routes/admin-auth';
import { adminBrandingMediaRoutes } from './routes/admin-branding-media';
import { adminCategoryBatchRoutes } from './routes/admin-category-batch';
import { adminCategoryRoutes } from './routes/admin-categories';
import { adminConversionPoolRoutes } from './routes/admin-conversion-pool';
import { adminConversionPreviewRoutes } from './routes/admin-conversion-preview';
import { adminCustomerServiceRoutes } from './routes/admin-customer-service';
import { adminFaqRoutes } from './routes/admin-faqs';
import { adminMediaDeleteRoutes } from './routes/admin-media-delete';
import { adminMediaFolderRoutes } from './routes/admin-media-folders';
import { adminMediaRoleRoutes } from './routes/admin-media-roles';
import { adminPublishRoutes } from './routes/admin-publish';
import { adminProductBatchRoutes } from './routes/admin-product-batch';
import { adminProductRoutes } from './routes/admin-products';
import { adminSectionBatchRoutes } from './routes/admin-section-batch';
import { adminSectionRoutes } from './routes/admin-sections';
import { adminSiteSettingsRoutes } from './routes/admin-site-settings';
import { adminTagRoutes } from './routes/admin-tags';
import { adminThemeRoutes } from './routes/admin-theme';
import { publicBottomNavigationRoutes } from './routes/public-bottom-navigation';
import { publicContentRoutes } from './routes/public-content';
import { publicConversionRoutes } from './routes/public-conversion';
import { publicImageVariantRoutes } from './routes/public-image-variant';
import { publicMediaFallbackRoutes } from './routes/public-media-fallback';
import { servePwaIcon, servePwaManifest } from './routes/public-pwa';
import {
  serveRobots,
  serveSitemap,
  serveStaticAsset,
  serveStorefrontDocument,
} from './routes/public-seo';
import { publicStorefrontConfigRoutes } from './routes/public-storefront-config';
import { publicThemeRoutes } from './routes/public-theme';
import type { AppEnvironment } from './types';

export const app = new Hono<AppEnvironment>({ strict: false });

app.use('*', securityHeaders);

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

app.get('/manifest.webmanifest', servePwaManifest);
app.get('/api/public/pwa/icon/:size', servePwaIcon);
app.on(['GET', 'HEAD'], '/robots.txt', serveRobots);
app.on(['GET', 'HEAD'], '/sitemap.xml', serveSitemap);

app.get('/api/health', (context) =>
  context.json({
    ok: true,
    service: 'service-catalog-site',
    environment: context.env.ENVIRONMENT,
    version: context.env.APP_VERSION,
    workerVersionId: context.env.CF_VERSION_METADATA?.id ?? null,
    workerVersionTag: context.env.CF_VERSION_METADATA?.tag ?? null,
    publicLanguage: 'en',
    timestamp: new Date().toISOString(),
    requestId: context.get('requestId'),
  }),
);

app.get('/api/public/version', (context) =>
  context.json({
    appVersion: context.env.APP_VERSION,
    workerVersionId: context.env.CF_VERSION_METADATA?.id ?? null,
    workerVersionTag: context.env.CF_VERSION_METADATA?.tag ?? null,
    deployedAt: context.env.CF_VERSION_METADATA?.timestamp ?? null,
    environment: context.env.ENVIRONMENT,
    publicLanguage: 'en',
  }),
);
app.route('/api/public/storefront', publicStorefrontConfigRoutes);
app.route('/api/public/bottom-navigation', publicBottomNavigationRoutes);
app.route('/api/public/theme', publicThemeRoutes);
app.route('/public', publicContentRoutes);
app.route('/_media', publicMediaFallbackRoutes);
app.route('/_image', publicImageVariantRoutes);

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
app.route('/api/admin/theme', adminThemeRoutes);
app.route('/api/admin/customer-service', adminCustomerServiceRoutes);
app.route('/api/admin/assets', adminAssetRoutes);
app.route('/api/admin/assets', adminMediaDeleteRoutes);
app.route('/api/admin/assets', adminMediaRoleRoutes);
app.route('/api/admin/assets', adminMediaFolderRoutes);
app.route('/api/admin/media', adminBrandingMediaRoutes);
app.route('/api/admin/faqs', adminFaqRoutes);
app.route('/api/admin/publish', adminPublishRoutes);
app.route('/api/admin/sections', adminProductBatchRoutes);
app.route('/api/admin/sections', adminProductRoutes);
app.route('/api/admin/sections', adminConversionPreviewRoutes);
app.route('/api/admin/sections', adminConversionPoolRoutes);
app.route('/api/admin/sections', adminTagRoutes);
app.route('/api/admin/sections', adminCategoryBatchRoutes);
app.route('/api/admin/sections', adminCategoryRoutes);
app.route('/api/admin/sections', adminSectionBatchRoutes);
app.route('/api/admin/sections', adminSectionRoutes);

app.route('/go', publicConversionRoutes);

app.on(['GET', 'HEAD'], '*', async (context) => {
  const pathname = new URL(context.req.url).pathname;
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/public/') ||
    pathname.startsWith('/_media/') ||
    pathname.startsWith('/_image/') ||
    pathname.startsWith('/go/')
  ) {
    return context.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'The requested route does not exist.',
          requestId: context.get('requestId'),
        },
      },
      404,
    );
  }
  if (pathname === '/admin') {
    return context.redirect('/admin/', 308);
  }
  if (pathname.startsWith('/admin/') || /\.[A-Za-z0-9]{1,12}$/u.test(pathname)) {
    return serveStaticAsset(context);
  }
  return serveStorefrontDocument(context);
});

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
