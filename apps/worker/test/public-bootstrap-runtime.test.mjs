import assert from 'node:assert/strict';
import test from 'node:test';
import { getStorefrontBootstrapRuntime } from '../src/routes/public-storefront-config.ts';

test('storefront bootstrap runtime reads media and bottom navigation in one D1 query', async () => {
  let prepareCount = 0;
  const db = {
    prepare(sql) {
      prepareCount += 1;
      assert.match(sql, /CROSS JOIN site_bottom_navigation nav/u);
      assert.match(sql, /LEFT JOIN media_assets asset/u);
      return {
        async all() {
          return {
            results: [
              {
                media_base_url: 'https://media.example.com',
                item_key: 'home',
                label: 'Home',
                icon_type: 'builtin',
                icon_value: 'home',
                is_enabled: 1,
                sort_order: 0,
                icon_object_key: null,
              },
              {
                media_base_url: 'https://media.example.com',
                item_key: 'browse',
                label: 'Browse',
                icon_type: 'asset',
                icon_value: null,
                is_enabled: 1,
                sort_order: 1,
                icon_object_key: 'navigation/browse.webp',
              },
              {
                media_base_url: 'https://media.example.com',
                item_key: 'messages',
                label: 'Messages',
                icon_type: 'builtin',
                icon_value: 'messages',
                is_enabled: 1,
                sort_order: 2,
                icon_object_key: null,
              },
              {
                media_base_url: 'https://media.example.com',
                item_key: 'faq',
                label: 'FAQ',
                icon_type: 'emoji',
                icon_value: '?',
                is_enabled: 0,
                sort_order: 3,
                icon_object_key: null,
              },
            ],
          };
        },
      };
    },
  };

  const runtime = await getStorefrontBootstrapRuntime(db);
  assert.equal(prepareCount, 1);
  assert.equal(runtime.mediaBaseUrl, 'https://media.example.com');
  assert.deepEqual(
    runtime.bottomNavigation.map((item) => item.key),
    ['home', 'browse', 'messages', 'faq'],
  );
  assert.deepEqual(runtime.bottomNavigation[1].icon, {
    type: 'image',
    value: 'https://media.example.com/navigation/browse.webp',
  });
  assert.equal(runtime.bottomNavigation[3].enabled, false);
});

test('storefront bootstrap runtime rejects incomplete navigation without extra D1 reads', async () => {
  let prepareCount = 0;
  const db = {
    prepare() {
      prepareCount += 1;
      return {
        async all() {
          return {
            results: [
              {
                media_base_url: 'https://media.example.com',
                item_key: 'home',
                label: 'Home',
                icon_type: 'builtin',
                icon_value: 'home',
                is_enabled: 1,
                sort_order: 0,
                icon_object_key: null,
              },
            ],
          };
        },
      };
    },
  };

  assert.equal(await getStorefrontBootstrapRuntime(db), null);
  assert.equal(prepareCount, 1);
});
