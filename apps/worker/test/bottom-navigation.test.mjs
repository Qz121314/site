import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isPublicBottomNavigationItemEnabled } from '../src/routes/public-bottom-navigation.ts';
import { validateBottomNavigationInput } from '../src/settings/bottom-navigation.ts';

const migrationSource = await readFile(
  new URL('../../../migrations/0018_bottom_navigation.sql', import.meta.url),
  'utf8',
);
const publicRouteSource = await readFile(
  new URL('../src/routes/public-bottom-navigation.ts', import.meta.url),
  'utf8',
);
const deleteSource = await readFile(
  new URL('../src/media/media-delete.ts', import.meta.url),
  'utf8',
);

const validItems = [
  {
    key: 'home',
    label: 'Home',
    enabled: true,
    iconType: 'builtin',
    iconValue: 'home',
    iconAssetId: null,
  },
  {
    key: 'browse',
    label: 'Explore',
    enabled: true,
    iconType: 'emoji',
    iconValue: '🧭',
    iconAssetId: null,
  },
  {
    key: 'messages',
    label: 'Chat',
    enabled: true,
    iconType: 'asset',
    iconValue: null,
    iconAssetId: 'media-nav',
  },
  {
    key: 'faq',
    label: 'Help',
    enabled: false,
    iconType: 'builtin',
    iconValue: 'help',
    iconAssetId: null,
  },
];

test('bottom navigation accepts fixed routes with configurable visibility labels and icons', () => {
  const result = validateBottomNavigationInput(validItems);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.provided, true);
});

test('bottom navigation rejects unknown or duplicate routes and invalid icon sources', () => {
  assert.equal(
    validateBottomNavigationInput([
      ...validItems.slice(0, 3),
      { ...validItems[3], key: 'home' },
    ]).ok,
    false,
  );
  assert.equal(
    validateBottomNavigationInput(
      validItems.map((item) =>
        item.key === 'home' ? { ...item, iconValue: 'unknown' } : item,
      ),
    ).ok,
    false,
  );
  assert.equal(
    validateBottomNavigationInput(
      validItems.map((item) =>
        item.key === 'messages' ? { ...item, iconAssetId: null } : item,
      ),
    ).ok,
    false,
  );
});

test('navigation image assets are foreign-keyed and protected from managed deletion', () => {
  assert.match(
    migrationSource,
    /icon_asset_id TEXT REFERENCES media_assets\(id\) ON DELETE RESTRICT/u,
  );
  assert.match(migrationSource, /prevent_bottom_navigation_asset_soft_delete/u);
  assert.match(
    deleteSource,
    /site_bottom_navigation nav WHERE nav\.icon_asset_id = ma\.id/u,
  );
  assert.match(publicRouteSource, /buildMediaUrl/u);
  assert.match(publicRouteSource, /max-age=30/u);
});

test('messages only appears publicly when customer service is actually available', () => {
  const messages = { key: 'messages', enabled: true };
  const home = { key: 'home', enabled: true };
  assert.equal(isPublicBottomNavigationItemEnabled(messages, false), false);
  assert.equal(isPublicBottomNavigationItemEnabled(messages, true), true);
  assert.equal(isPublicBottomNavigationItemEnabled(home, false), true);
  assert.equal(
    isPublicBottomNavigationItemEnabled({ ...home, enabled: false }, true),
    false,
  );
  assert.match(publicRouteSource, /hasEnabledCustomerServiceConnection/u);
});
