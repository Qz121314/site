import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('site settings keep webpage logo and PWA app icon as separate assets', () => {
  const viewSource = source('../src/SiteSettingsView.tsx');
  const settingsApiSource = source('../src/site-hero-settings-api.ts');
  const brandingSource = source('../src/branding-media/local-branding-image.ts');

  assert.match(viewSource, /站点 Logo（网页品牌）/u);
  assert.match(viewSource, /PWA 图标 \/ App Icon/u);
  assert.match(viewSource, /prepareBrandingImage\(file, 'pwa-icon'\)/u);
  assert.match(viewSource, /pwaIconAssetId/u);
  assert.match(viewSource, /role="icon"/u);
  assert.match(settingsApiSource, /pwaIconAssetId/u);
  assert.match(brandingSource, /'pwa-icon'/u);
});
