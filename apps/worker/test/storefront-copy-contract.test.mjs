import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const settingsSource = await readFile(
  new URL('../src/settings/site-settings.ts', import.meta.url),
  'utf8',
);
const adminRouteSource = await readFile(
  new URL('../src/routes/admin-site-settings.ts', import.meta.url),
  'utf8',
);
const indexSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const migrationSource = await readFile(
  new URL('../../../migrations/0017_storefront_copy.sql', import.meta.url),
  'utf8',
);

test('historical Storefront Copy migration remains immutable for deployed databases', () => {
  assert.match(
    migrationSource,
    /ADD COLUMN storefront_copy_json TEXT NOT NULL DEFAULT '\{\}'/u,
  );
});

test('site settings runtime no longer reads, validates, or writes Storefront Copy', () => {
  assert.doesNotMatch(
    settingsSource,
    /StorefrontCopy|storefrontCopy|storefront_copy_json/u,
  );
  assert.doesNotMatch(adminRouteSource, /storefrontCopy/u);
});

test('public Storefront Copy API is no longer mounted', () => {
  assert.doesNotMatch(
    indexSource,
    /publicStorefrontCopyRoutes|\/api\/public\/storefront-copy/u,
  );
});
