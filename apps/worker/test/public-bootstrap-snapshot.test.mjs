import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadStorefrontPublishedBootstrap,
  storefrontBootstrapSnapshotKey,
} from '../src/publishing/storefront-bootstrap-snapshot.ts';

const pointer = {
  schemaVersion: 2,
  contentVersion: '20260819190000-pointer-bootstrap01',
  publishedAt: '2026-08-19T19:00:00.000Z',
  site: {
    contentVersion: '20260819185000-site-bootstrap001',
    manifestKey: 'public/modules/site/20260819185000-site-bootstrap001/manifest.json',
    sourceRevision: 'site-source',
    publishedAt: '2026-08-19T18:50:00.000Z',
  },
  sectionsIndex: {
    contentVersion: '20260819185100-index-bootstrap01',
    manifestKey:
      'public/modules/sections-index/20260819185100-index-bootstrap01/manifest.json',
    sourceRevision: 'index-source',
    publishedAt: '2026-08-19T18:51:00.000Z',
  },
  faq: {
    contentVersion: '20260819185200-faq-bootstrap001',
    manifestKey: 'public/modules/faq/20260819185200-faq-bootstrap001/manifest.json',
    sourceRevision: 'faq-source',
    publishedAt: '2026-08-19T18:52:00.000Z',
  },
};

const messagePath = pointer.faq.manifestKey.replace(/manifest\.json$/u, 'messages.json');

function sourceObjects({ messages = null } = {}) {
  const articles = Array.isArray(messages?.articles)
    ? messages.articles.map((article) => ({
        articleId: article.articleId,
        title: article.title,
        preview: article.preview,
        backgroundObjectKey: article.backgroundObjectKey ?? null,
        sortOrder: article.sortOrder,
      }))
    : [];
  const site = {
    schemaVersion: 2,
    site: {
      name: 'Example',
      navigation: { showFaq: true, messageArticles: articles },
      runtime: {
        mediaBaseUrl: 'https://media.example.com',
        theme: {},
        bottomNavigation: [],
      },
    },
  };
  const sectionsIndex = { schemaVersion: 2, sections: [] };
  const home = { schemaVersion: 2, featuredProducts: [], latestProducts: [] };
  const objects = new Map([
    [
      pointer.site.manifestKey.replace(/manifest\.json$/u, 'site.json'),
      JSON.stringify(site),
    ],
    [
      pointer.sectionsIndex.manifestKey.replace(/manifest\.json$/u, 'sections.json'),
      JSON.stringify(sectionsIndex),
    ],
    [`public/home/${pointer.contentVersion}/home.json`, JSON.stringify(home)],
  ]);
  objects.set(
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
    JSON.stringify({
      schemaVersion: 4,
      pointerVersion: pointer.contentVersion,
      site,
      sectionsIndex,
      home,
    }),
  );
  if (messages !== null) objects.set(messagePath, JSON.stringify(messages));
  return objects;
}

function createBucket(objects, { failWrites = false } = {}) {
  const reads = [];
  const writes = [];
  return {
    objects,
    reads,
    writes,
    async get(key) {
      reads.push(key);
      const body = objects.get(key);
      if (body === undefined) return null;
      return {
        async text() {
          return body;
        },
      };
    },
    async put(key, body, options) {
      if (failWrites) throw new Error('simulated R2 write failure');
      const text = String(body);
      objects.set(key, text);
      writes.push({ key, body: text, options });
      return { key };
    },
  };
}

test('bootstrap reads a complete published artifact without runtime reconstruction', async () => {
  const objects = sourceObjects();
  const bucket = createBucket(objects, { failWrites: true });

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.equal(snapshot.site.site.name, 'Example');
  assert.deepEqual(snapshot.site.site.navigation.messageArticles, []);
  assert.deepEqual(snapshot.sectionsIndex.sections, []);
  assert.deepEqual(snapshot.home.featuredProducts, []);
  assert.deepEqual(bucket.reads, [
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
  ]);
  assert.equal(bucket.writes.length, 0);
});

test('bootstrap carries only lightweight active Messages Article metadata and preserves existing navigation', async () => {
  const objects = sourceObjects({
    messages: {
      schemaVersion: 2,
      moduleKey: 'faq',
      articles: [
        {
          articleId: 'article-a',
          title: 'Announcement',
          preview: 'Short preview',
          backgroundObjectKey: 'media/messages/announcement.webp',
          sortOrder: 0,
          body: '# Full Markdown that must not enter bootstrap',
          internalFlag: true,
        },
      ],
    },
  });
  const bucket = createBucket(objects);

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.equal(snapshot.site.site.navigation.showFaq, true);
  assert.deepEqual(snapshot.site.site.navigation.messageArticles, [
    {
      articleId: 'article-a',
      title: 'Announcement',
      preview: 'Short preview',
      backgroundObjectKey: 'media/messages/announcement.webp',
      sortOrder: 0,
    },
  ]);
  assert.equal(JSON.stringify(snapshot).includes('Full Markdown'), false);
  assert.equal(JSON.stringify(snapshot).includes('internalFlag'), false);
});

test('bootstrap accepts legacy Messages Article metadata without a background field', async () => {
  const objects = sourceObjects({
    messages: {
      schemaVersion: 2,
      moduleKey: 'faq',
      articles: [
        {
          articleId: 'article-legacy',
          title: 'Legacy article',
          preview: 'Legacy preview',
          sortOrder: 0,
        },
      ],
    },
  });
  const bucket = createBucket(objects);

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.deepEqual(snapshot.site.site.navigation.messageArticles, [
    {
      articleId: 'article-legacy',
      title: 'Legacy article',
      preview: 'Legacy preview',
      backgroundObjectKey: null,
      sortOrder: 0,
    },
  ]);
});

test('bootstrap preserves an empty published Messages Article list without reading FAQ modules', async () => {
  const objects = sourceObjects();
  const bucket = createBucket(objects);

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.deepEqual(snapshot.site.site.navigation.messageArticles, []);
  assert.deepEqual(bucket.reads, [
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
  ]);
});

test('bootstrap rejects a stale schema bundle rather than rebuilding it at runtime', async () => {
  const objects = sourceObjects({
    messages: {
      schemaVersion: 2,
      moduleKey: 'faq',
      articles: [
        {
          articleId: 'article-a',
          title: 'Announcement',
          preview: 'Fresh preview',
          sortOrder: 0,
        },
      ],
    },
  });
  objects.set(
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
    JSON.stringify({
      schemaVersion: 2,
      pointerVersion: pointer.contentVersion,
      site: { schemaVersion: 2, site: { name: 'Stale without Messages metadata' } },
      sectionsIndex: { schemaVersion: 2, sections: [] },
      home: { schemaVersion: 2, featuredProducts: [] },
    }),
  );
  const bucket = createBucket(objects);

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.equal(snapshot, null);
  assert.deepEqual(bucket.reads, [
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
  ]);
  assert.equal(bucket.writes.length, 0);
});

test('bootstrap snapshot refuses a cached bundle from a different pointer version without rebuilding it', async () => {
  const objects = sourceObjects();
  objects.set(
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
    JSON.stringify({
      schemaVersion: 3,
      pointerVersion: '20260819170000-other-pointer0001',
      site: { schemaVersion: 2, site: { name: 'Stale' } },
      sectionsIndex: { schemaVersion: 2, sections: [] },
      home: { schemaVersion: 2, featuredProducts: [] },
    }),
  );
  const bucket = createBucket(objects);

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.equal(snapshot, null);
  assert.deepEqual(bucket.reads, [
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
  ]);
  assert.equal(bucket.writes.length, 0);
});
