import assert from 'node:assert/strict';
import { Hono } from 'hono';
import test from 'node:test';
import { adminAssetRoutes } from '../src/routes/admin-assets.ts';

function withRequestId(routes) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('requestId', 'test-request-id');
    await next();
  });
  app.route('/', routes);
  return app;
}

test('R2 cleanup reports only objects physically deleted', async () => {
  const deletedKeys = [];
  const object = {
    key: 'media/present.webp',
    size: 100,
    etag: 'etag-1',
    uploaded: new Date('2026-08-07T00:00:00.000Z'),
    httpMetadata: { contentType: 'image/webp' },
  };
  const db = {
    prepare(sql) {
      return {
        sql,
        bind() {
          return this;
        },
        async first() {
          return null;
        },
        async run() {
          return { meta: { changes: 0 } };
        },
        async all() {
          return { results: [] };
        },
      };
    },
    async batch() {
      return [];
    },
  };
  const bucket = {
    async head(key) {
      return key === object.key ? object : null;
    },
    async delete(keys) {
      deletedKeys.push(...keys);
    },
  };

  const app = withRequestId(adminAssetRoutes);
  const response = await app.request(
    'http://local.test/cleanup',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-request': '1',
        'x-idempotency-key': 'cleanup-count-1',
      },
      body: JSON.stringify({ keys: [object.key, 'media/missing.webp'] }),
    },
    { DB: db, ASSETS_BUCKET: bucket },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    deletedKeys: [object.key, 'media/missing.webp'],
    deletedCount: 1,
    alreadyMissingCount: 1,
    freedBytes: 100,
  });
  assert.deepEqual(deletedKeys, [object.key]);
});
