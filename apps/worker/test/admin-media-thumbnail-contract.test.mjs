import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeSource = await readFile(
  new URL('../src/routes/admin-branding-media.ts', import.meta.url),
  'utf8',
);
const indexSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const wranglerSource = await readFile(
  new URL('../../../wrangler.jsonc', import.meta.url),
  'utf8',
);

test('admin media thumbnails transform R2 bytes directly through the Images binding', () => {
  assert.match(wranglerSource, /"images"\s*:\s*\{[\s\S]*?"binding"\s*:\s*"IMAGES"/u);
  assert.match(routeSource, /context\.env\.IMAGES\.input\(object\.body\)/u);
  assert.match(routeSource, /ADMIN_THUMBNAIL_SIZE = 240/u);
  assert.match(routeSource, /fit: 'scale-down'/u);
  assert.match(routeSource, /format: 'image\/webp'/u);
  assert.match(routeSource, /quality: ADMIN_THUMBNAIL_QUALITY/u);
  assert.match(routeSource, /anim: false/u);
  assert.match(routeSource, /\/assets\/:id\/thumbnail/u);
  assert.match(routeSource, /MEDIA_THUMBNAIL_FAILED/u);
  assert.doesNotMatch(
    routeSource,
    /image-resizing|THUMBNAIL_TOKEN_NAMESPACE|signThumbnailSource/u,
  );
  assert.doesNotMatch(
    indexSource,
    /adminMediaThumbnailSourceRoutes|__admin-media-thumbnail-source/u,
  );
});
