import assert from 'node:assert/strict';
import test from 'node:test';
import {
  materializeDerivedHomeSnapshot,
  materializeDerivedSearchSnapshot,
} from '../src/publishing/storefront-publisher.ts';

const SECTION_REFERENCE = {
  contentVersion: 'section-v1',
  manifestKey: 'public/modules/sections/section-a/section-v1/manifest.json',
  sourceRevision: 'source-v1',
  publishedAt: '2026-08-07T09:00:00.000Z',
};

const pointer = {
  schemaVersion: 2,
  contentVersion: 'pointer-v1',
  publishedAt: '2026-08-07T09:00:00.000Z',
  site: SECTION_REFERENCE,
  sectionsIndex: SECTION_REFERENCE,
  faq: SECTION_REFERENCE,
  sections: { 'section-a': SECTION_REFERENCE },
};

const sectionSnapshot = {
  schemaVersion: 2,
  moduleKey: 'section:section-a',
  contentVersion: SECTION_REFERENCE.contentVersion,
  publishedAt: SECTION_REFERENCE.publishedAt,
  sectionId: 'section-a',
  products: [
    {
      id: 'visible-product',
      slug: 'visible-product',
      sectionId: 'section-a',
      title: 'Visible product',
      serviceMode: 'online',
      address: null,
      category: { id: null, name: null },
      tags: [],
      coverObjectKey: null,
      isVisible: true,
      isFeatured: true,
      featuredOrder: 0,
      publishedAt: '2026-08-07T08:00:00.000Z',
      sortOrder: 0,
    },
    {
      id: 'hidden-product',
      slug: 'hidden-product',
      sectionId: 'section-a',
      title: 'Hidden product',
      serviceMode: 'online',
      address: null,
      category: { id: null, name: null },
      tags: [],
      coverObjectKey: null,
      isVisible: false,
      isFeatured: true,
      featuredOrder: 1,
      publishedAt: '2026-08-07T08:30:00.000Z',
      sortOrder: 1,
    },
  ],
};

function createBucket() {
  const objects = new Map([
    ['public/current.json', JSON.stringify(pointer)],
    [
      'public/modules/sections/section-a/section-v1/section.json',
      JSON.stringify(sectionSnapshot),
    ],
  ]);
  return {
    objects,
    async get(key) {
      const body = objects.get(key);
      return body === undefined ? null : { text: async () => body };
    },
    async put(key, body) {
      objects.set(key, String(body));
    },
    async list() {
      return { objects: [] };
    },
  };
}

test('hidden products stay out of derived home and search listings', async () => {
  const bucket = createBucket();
  const homeKey = await materializeDerivedHomeSnapshot(bucket);
  const searchKey = await materializeDerivedSearchSnapshot(bucket);
  const home = JSON.parse(bucket.objects.get(homeKey));
  const search = JSON.parse(bucket.objects.get(searchKey));

  assert.deepEqual(
    home.featuredProducts.map((product) => product.id),
    ['visible-product'],
  );
  assert.deepEqual(
    home.latestProducts.map((product) => product.id),
    ['visible-product'],
  );
  assert.deepEqual(
    search.products.map((product) => product.id),
    ['visible-product'],
  );
});
