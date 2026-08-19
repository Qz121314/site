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
};

function sourceObjects() {
  return new Map([
    [
      pointer.site.manifestKey.replace(/manifest\.json$/u, 'site.json'),
      JSON.stringify({ schemaVersion: 2, site: { name: 'Example' } }),
    ],
    [
      pointer.sectionsIndex.manifestKey.replace(/manifest\.json$/u, 'sections.json'),
      JSON.stringify({ schemaVersion: 2, sections: [] }),
    ],
    [
      `public/home/${pointer.contentVersion}/home.json`,
      JSON.stringify({ schemaVersion: 2, featuredProducts: [], latestProducts: [] }),
    ],
  ]);
}

test('bootstrap snapshot write failure never breaks the existing published-content fallback', async () => {
  const objects = sourceObjects();
  const reads = [];
  const bucket = {
    async get(key) {
      reads.push(key);
      const body = objects.get(key);
      if (body === undefined) return null;
      return { async text() { return body; } };
    },
    async put() {
      throw new Error('simulated R2 write failure');
    },
  };

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.equal(snapshot.site.site.name, 'Example');
  assert.deepEqual(snapshot.sectionsIndex.sections, []);
  assert.deepEqual(snapshot.home.featuredProducts, []);
  assert.deepEqual(reads, [
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
    pointer.site.manifestKey.replace(/manifest\.json$/u, 'site.json'),
    pointer.sectionsIndex.manifestKey.replace(/manifest\.json$/u, 'sections.json'),
    `public/home/${pointer.contentVersion}/home.json`,
  ]);
});

test('bootstrap snapshot refuses a cached bundle from a different pointer version', async () => {
  const objects = sourceObjects();
  objects.set(
    storefrontBootstrapSnapshotKey(pointer.contentVersion),
    JSON.stringify({
      schemaVersion: 1,
      pointerVersion: '20260819170000-other-pointer0001',
      site: { schemaVersion: 2, site: { name: 'Stale' } },
      sectionsIndex: { schemaVersion: 2, sections: [] },
      home: { schemaVersion: 2, featuredProducts: [] },
    }),
  );
  const writes = [];
  const bucket = {
    async get(key) {
      const body = objects.get(key);
      if (body === undefined) return null;
      return { async text() { return body; } };
    },
    async put(key, body) {
      writes.push(key);
      objects.set(key, String(body));
      return { key };
    },
  };

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.equal(snapshot.site.site.name, 'Example');
  assert.deepEqual(writes, [storefrontBootstrapSnapshotKey(pointer.contentVersion)]);
});
