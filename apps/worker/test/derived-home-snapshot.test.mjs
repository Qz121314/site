import assert from 'node:assert/strict';
import test from 'node:test';
import { materializeDerivedHomeSnapshot } from '../src/publishing/storefront-publisher.ts';

const POINTER_VERSION = '20260808190000-pointer-feedbeef';
const SECTION_A_VERSION = '20260808190100-sectiona12345-acde1234';
const SECTION_B_VERSION = '20260808190200-sectionb12345-acde1235';

function reference(contentVersion, sectionId) {
  return {
    contentVersion,
    manifestKey: `public/modules/sections/${sectionId}/${contentVersion}/manifest.json`,
    sourceRevision: `source-${sectionId}`,
    publishedAt: '2026-08-08T19:02:00.000Z',
  };
}

const POINTER = {
  schemaVersion: 2,
  contentVersion: POINTER_VERSION,
  publishedAt: '2026-08-08T19:03:00.000Z',
  site: {
    contentVersion: '20260808185800-site12345678-acde1200',
    manifestKey: 'public/modules/site/20260808185800-site12345678-acde1200/manifest.json',
    sourceRevision: 'site-source',
    publishedAt: '2026-08-08T18:58:00.000Z',
  },
  sectionsIndex: {
    contentVersion: '20260808185900-index1234567-acde1201',
    manifestKey:
      'public/modules/sections-index/20260808185900-index1234567-acde1201/manifest.json',
    sourceRevision: 'index-source',
    publishedAt: '2026-08-08T18:59:00.000Z',
  },
  faq: {
    contentVersion: '20260808185930-faq123456789-acde1202',
    manifestKey: 'public/modules/faq/20260808185930-faq123456789-acde1202/manifest.json',
    sourceRevision: 'faq-source',
    publishedAt: '2026-08-08T18:59:30.000Z',
  },
  sections: {
    'section-a': reference(SECTION_A_VERSION, 'section-a'),
    'section-b': reference(SECTION_B_VERSION, 'section-b'),
  },
};

function product(sectionId, id, featuredOrder, publishedAt) {
  return {
    id,
    slug: `${id}-slug`,
    sectionId,
    title: `Product ${id}`,
    serviceMode: 'online',
    address: null,
    category: { id: null, name: null },
    tags: [],
    coverObjectKey: `products/${id}/cover.webp`,
    isFeatured: true,
    featuredOrder,
    publishedAt,
    sortOrder: 0,
  };
}

function sectionSnapshot(sectionId, contentVersion, item) {
  return {
    schemaVersion: 2,
    moduleKey: `section:${sectionId}`,
    contentVersion,
    publishedAt: '2026-08-08T19:02:00.000Z',
    sectionId,
    categories: [],
    tags: [],
    products: [item],
  };
}

function createBucket() {
  const now = new Date('2026-08-08T19:04:00.000Z');
  const objects = new Map([
    ['public/current.json', JSON.stringify(POINTER)],
    [
      `public/modules/sections/section-a/${SECTION_A_VERSION}/section.json`,
      JSON.stringify(
        sectionSnapshot(
          'section-a',
          SECTION_A_VERSION,
          product('section-a', 'product-a', 2, '2026-08-08T19:02:00.000Z'),
        ),
      ),
    ],
    [
      `public/modules/sections/section-b/${SECTION_B_VERSION}/section.json`,
      JSON.stringify(
        sectionSnapshot(
          'section-b',
          SECTION_B_VERSION,
          product('section-b', 'product-b', 1, '2026-08-08T19:01:00.000Z'),
        ),
      ),
    ],
  ]);
  const metadata = new Map();
  const writes = [];
  return {
    objects,
    writes,
    async get(key) {
      const body = objects.get(key);
      if (body === undefined) return null;
      return {
        async text() {
          return body;
        },
      };
    },
    async put(key, body, options) {
      const text = String(body);
      objects.set(key, text);
      metadata.set(key, { key, uploaded: now });
      writes.push({ key, body: text, options });
      return { key };
    },
    async list({ prefix }) {
      return {
        objects: [...metadata.values()].filter((item) => item.key.startsWith(prefix)),
        truncated: false,
      };
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        objects.delete(key);
        metadata.delete(key);
      }
    },
  };
}

test('derived home snapshot aggregates the current section versions into one immutable R2 read', async () => {
  const bucket = createBucket();
  const key = await materializeDerivedHomeSnapshot(bucket);

  assert.equal(key, `public/home/${POINTER_VERSION}/home.json`);
  const home = JSON.parse(bucket.objects.get(key));
  assert.equal(home.schemaVersion, 2);
  assert.equal(home.pointerVersion, POINTER_VERSION);
  assert.deepEqual(
    home.featuredProducts.map((item) => item.id),
    ['product-b', 'product-a'],
  );
  assert.deepEqual(
    home.latestProducts.map((item) => item.id),
    ['product-a', 'product-b'],
  );
  assert.equal(bucket.writes.length, 1);
  assert.equal(
    bucket.writes[0].options.httpMetadata.cacheControl,
    'public, max-age=31536000, immutable',
  );
});
