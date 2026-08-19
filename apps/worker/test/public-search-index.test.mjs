import assert from 'node:assert/strict';
import test from 'node:test';
import { publicStorefrontConfigRoutes } from '../src/routes/public-storefront-config.ts';

const POINTER_VERSION = '20260819194500-pointer-search01';
const SEARCH_PAYLOAD = {
  schemaVersion: 2,
  pointerVersion: POINTER_VERSION,
  publishedAt: '2026-08-19T19:45:00.000Z',
  products: [
    {
      id: 'product-1',
      slug: 'product-one',
      sectionId: 'section-1',
      title: 'Product One',
      serviceMode: 'online',
      address: null,
      category: { id: 'category-1', name: 'Category One' },
      tags: [],
      coverObjectKey: null,
      isFeatured: false,
      featuredOrder: 0,
      publishedAt: '2026-08-19T19:40:00.000Z',
      sortOrder: 0,
    },
  ],
};

test('storefront search index serves one immutable versioned R2 object', async () => {
  const body = JSON.stringify(SEARCH_PAYLOAD);
  let reads = 0;
  const bucket = {
    async get(key) {
      reads += 1;
      assert.equal(key, `public/search/${POINTER_VERSION}/search.json`);
      return {
        body,
        size: Buffer.byteLength(body),
        httpEtag: '"search-etag"',
        httpMetadata: {
          contentType: 'application/json; charset=utf-8',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      };
    },
  };

  const response = await publicStorefrontConfigRoutes.request(
    `https://storefront.example.com/search-index/${POINTER_VERSION}`,
    {},
    { ASSETS_BUCKET: bucket },
  );

  assert.equal(response.status, 200);
  assert.equal(reads, 1);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(response.headers.get('etag'), '"search-etag"');
  assert.deepEqual(await response.json(), SEARCH_PAYLOAD);
});

test('storefront search index rejects invalid pointer versions before reading R2', async () => {
  const bucket = {
    async get() {
      throw new Error('R2 must not be read for an invalid pointer version.');
    },
  };

  const response = await publicStorefrontConfigRoutes.request(
    'https://storefront.example.com/search-index/not%20valid',
    {},
    { ASSETS_BUCKET: bucket },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { available: false });
});
