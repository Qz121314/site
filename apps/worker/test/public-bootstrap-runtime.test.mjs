import assert from 'node:assert/strict';
import test from 'node:test';
import { publicStorefrontConfigRoutes } from '../src/routes/public-storefront-config.ts';

const version = '20260908130000-pointer-bootstrap01';
const pointer = { schemaVersion: 2, contentVersion: version };
const bootstrap = {
  schemaVersion: 4,
  pointerVersion: version,
  site: {
    schemaVersion: 2,
    site: {
      name: 'Example',
      navigation: { messageArticles: [] },
      runtime: {
        mediaBaseUrl: 'https://media.example.com',
        theme: { key: 'saas' },
        bottomNavigation: [{ key: 'home', label: 'Home', enabled: true }],
      },
    },
  },
  sectionsIndex: { schemaVersion: 2, sections: [] },
  home: { schemaVersion: 2, featuredProducts: [], latestProducts: [] },
};

function bucket(values) {
  return {
    async get(key) {
      const value = values.get(key);
      return value === undefined
        ? null
        : {
            async text() {
              return value;
            },
          };
    },
  };
}
function failOnD1Access() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('bootstrap must not access D1');
      },
    },
  );
}

test('ordinary published bootstrap reads only R2 and performs zero D1 operations', async () => {
  const values = new Map([
    ['public/current.json', JSON.stringify(pointer)],
    [`public/bootstrap/${version}/bootstrap.json`, JSON.stringify(bootstrap)],
  ]);
  const response = await publicStorefrontConfigRoutes.request(
    'https://storefront.example.com/bootstrap',
    {},
    { ASSETS_BUCKET: bucket(values), DB: failOnD1Access() },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    (await response.json()).bottomNavigation,
    bootstrap.site.site.runtime.bottomNavigation,
  );
});

for (const [label, body] of [
  ['missing', undefined],
  ['corrupt', '{not-json'],
]) {
  test(`${label} bootstrap fails without D1 fallback`, async () => {
    const values = new Map([['public/current.json', JSON.stringify(pointer)]]);
    if (body !== undefined)
      values.set(`public/bootstrap/${version}/bootstrap.json`, body);
    const response = await publicStorefrontConfigRoutes.request(
      'https://storefront.example.com/bootstrap',
      {},
      { ASSETS_BUCKET: bucket(values), DB: failOnD1Access() },
    );
    assert.equal(response.status, 404);
  });
}
