import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('PWA app icon has an independent setting and never reads the webpage logo', () => {
  const routeSource = source('../src/routes/public-pwa.ts');
  const settingsSource = source('../src/settings/site-settings.ts');
  const mediaDeleteSource = source('../src/media/media-delete.ts');
  const migrationSource = source('../../../migrations/0029_pwa_icon_asset.sql');

  assert.match(routeSource, /settings\.pwa_icon_asset_id/u);
  assert.doesNotMatch(routeSource, /settings\.logo_asset_id/u);
  assert.match(routeSource, /\/icons\/app-icon-512\.png/u);

  assert.match(settingsSource, /pwaIconAssetId/u);
  assert.match(settingsSource, /pwa_icon_asset_id/u);
  assert.match(migrationSource, /ADD COLUMN pwa_icon_asset_id/u);
  assert.doesNotMatch(migrationSource, /logo_asset_id/u);

  assert.match(mediaDeleteSource, /pwa_icon_asset_id/u);
});
