import assert from 'node:assert/strict';
import test from 'node:test';
import {
  publicSnapshotCacheControl,
  publicSnapshotObjectKey,
} from '../src/public-content/public-snapshot.ts';
import { publicContentRoutes } from '../src/routes/public-content.ts';

test('public snapshot path accepts current and immutable snapshot JSON', () => {
  assert.equal(publicSnapshotObjectKey('current.json'), 'public/current.json');
  assert.equal(
    publicSnapshotObjectKey('modules/site/version-123456/site.json'),
    'public/modules/site/version-123456/site.json',
  );
  assert.equal(
    publicSnapshotObjectKey('versions/version-123456/products/product-1.json'),
    'public/versions/version-123456/products/product-1.json',
  );
});

test('public snapshot path rejects traversal and non-public object shapes', () => {
  assert.equal(publicSnapshotObjectKey('../private.json'), null);
  assert.equal(publicSnapshotObjectKey('%2e%2e/private.json'), null);
  assert.equal(publicSnapshotObjectKey('modules/site/../../private.json'), null);
  assert.equal(publicSnapshotObjectKey('private/secret.json'), null);
  assert.equal(publicSnapshotObjectKey('modules/site/version-123456/file.txt'), null);
});

test('public pointer stays short cached while immutable snapshots stay long cached', () => {
  assert.equal(
    publicSnapshotCacheControl('public/current.json', 'public, max-age=999'),
    'public, max-age=30, must-revalidate',
  );
  assert.equal(
    publicSnapshotCacheControl(
      'public/modules/site/version-123456/site.json',
      'public, max-age=31536000, immutable',
    ),
    'public, max-age=31536000, immutable',
  );
});

test('public content route reads only the requested public JSON object from R2', async () => {
  const requested = [];
  const env = {
    ASSETS_BUCKET: {
      async get(key) {
        requested.push(key);
        if (key !== 'public/current.json') return null;
        const body = JSON.stringify({ schemaVersion: 2 });
        return {
          body,
          size: Buffer.byteLength(body),
          httpEtag: '"etag-current"',
          httpMetadata: {
            contentType: 'application/json; charset=utf-8',
            cacheControl: 'public, max-age=999',
          },
        };
      },
      async head() {
        return null;
      },
    },
  };

  const response = await publicContentRoutes.request('/current.json', {}, env);
  assert.equal(response.status, 200);
  assert.deepEqual(requested, ['public/current.json']);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=30, must-revalidate');
  assert.equal(response.headers.get('etag'), '"etag-current"');
  assert.deepEqual(await response.json(), { schemaVersion: 2 });
});

test('public content route never exposes keys outside public snapshot prefixes', async () => {
  let called = false;
  const env = {
    ASSETS_BUCKET: {
      async get() {
        called = true;
        return null;
      },
      async head() {
        called = true;
        return null;
      },
    },
  };

  const response = await publicContentRoutes.request('/../private.json', {}, env);
  assert.equal(response.status, 404);
  assert.equal(called, false);
});
