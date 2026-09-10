import { Hono } from 'hono';
import { publicPageRoutes } from './routes/public-pages';
import type { AppEnvironment } from './types';

export const h5App = new Hono<AppEnvironment>({ strict: false });

h5App.use('*', async (context, next) => {
  await next();
  context.header(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(), payment=()',
  );
  context.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('X-Frame-Options', 'DENY');
});

h5App.route('/pages', publicPageRoutes);

h5App.notFound((context) => context.text('Not Found', 404));

export default h5App;
