import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeSource = await readFile(
  new URL('../src/routes/admin-branding-media.ts', import.meta.url),
  'utf8',
);
const indexSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');

test('admin media thumbnails are edge-resized and do not expose the raw source route', () => {
  assert.match(routeSource, /ADMIN_THUMBNAIL_SIZE = 240/);
  assert.match(routeSource, /fit: 'scale-down'/);
  assert.match(routeSource, /anim: false/);
  assert.match(routeSource, /format: 'webp'/);
  assert.match(routeSource, /\/assets\/:id\/thumbnail/);
  assert.match(routeSource, /image-resizing/i);
  assert.match(routeSource, /HMAC/);
  assert.match(routeSource, /MEDIA_THUMBNAIL_FAILED/);

  const sourceRouteIndex = indexSource.indexOf(
    "app.route('/__admin-media-thumbnail-source', adminMediaThumbnailSourceRoutes);",
  );
  const adminGuardIndex = indexSource.indexOf("app.use('/api/admin/*', requireAdmin);");
  assert.ok(sourceRouteIndex >= 0);
  assert.ok(adminGuardIndex > sourceRouteIndex);
});
