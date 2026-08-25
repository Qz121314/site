import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeUrl = new URL('../src/routes/public-pwa.ts', import.meta.url);
const settingsUrl = new URL('../src/settings/site-settings.ts', import.meta.url);
const mediaDeleteUrl = new URL('../src/media/media-delete.ts', import.meta.url);
const migrationUrl = new URL('../../../migrations/0029_pwa_icon_asset.sql', import.meta.url);

test('PWA app icon has an independent setting and never reads the webpage logo', async () => {
  const [routeSource, settingsSource, mediaDeleteSource, migrationSource] = await Promise.all([
    readFile(routeUrl, 'utf8'),
    readFile(settingsUrl, 'utf8'),
    readFile(mediaDeleteUrl, 'utf8'),
    readFile(migrationUrl, 'utf8'),
  ]);

  assert.match(routeSource, /settings\.pwa_icon_asset_id/u);
  assert.doesNotMatch(routeSource, /settings\.logo_asset_id/u);
  assert.match(routeSource, /\/icons\/app-icon-512\.png/u);

  assert.match(settingsSource, /pwaIconAssetId/u);
  assert.match(settingsSource, /pwa_icon_asset_id/u);
  assert.match(migrationSource, /ADD COLUMN pwa_icon_asset_id/u);
  assert.doesNotMatch(migrationSource, /logo_asset_id/u);

  assert.match(mediaDeleteSource, /pwa_icon_asset_id/u);
});
