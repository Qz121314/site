import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const viewUrl = new URL('../src/SiteSettingsView.tsx', import.meta.url);
const settingsApiUrl = new URL('../src/site-hero-settings-api.ts', import.meta.url);
const brandingUrl = new URL('../src/branding-media/local-branding-image.ts', import.meta.url);

test('site settings keep webpage logo and PWA app icon as separate assets', async () => {
  const [viewSource, settingsApiSource, brandingSource] = await Promise.all([
    readFile(viewUrl, 'utf8'),
    readFile(settingsApiUrl, 'utf8'),
    readFile(brandingUrl, 'utf8'),
  ]);

  assert.match(viewSource, /站点 Logo（网页品牌）/u);
  assert.match(viewSource, /PWA 图标 \/ App Icon/u);
  assert.match(viewSource, /prepareBrandingImage\(file, 'pwa-icon'\)/u);
  assert.match(viewSource, /pwaIconAssetId/u);
  assert.match(viewSource, /role="icon"/u);
  assert.match(settingsApiSource, /pwaIconAssetId/u);
  assert.match(brandingSource, /'pwa-icon'/u);
});
