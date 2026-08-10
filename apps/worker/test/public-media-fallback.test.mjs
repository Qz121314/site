import assert from 'node:assert/strict';
import test from 'node:test';
import { publicMediaFallbackObjectKey } from '../src/public-media/public-media-fallback.ts';
import { publicMediaFallbackRoutes } from '../src/routes/public-media-fallback.ts';

function createEnv({ tracked = true, partial = false } = {}) {
  const reads = [];
  const db = {
    prepare(sql) {
      assert.match(sql, /FROM media_assets/u);
      return {
        bind(objectKey) {
          return {
            async first() {
              reads.push({ type: 'db', objectKey });
              return tracked ? { id: 'asset-1' } : null;
            },
          };
        },
      };
    },
  };
  const object = {
    body: 'image-data',
    size: 10,
    httpEtag: '"media-etag"',
    httpMetadata: {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    ...(partial ? { range: { offset: 2, length: 4 } } : {}),
    writeHttpMetadata(headers) {
      headers.set('Content-Type', this.httpMetadata.contentType);
      headers.set('Cache-Control', this.httpMetadata.cacheControl);
    },
  };
  const bucket = {
    async get(objectKey, options) {
      reads.push({ type: 'get', objectKey, hasRange: Boolean(options?.range) });
      return object;
    },
    async head(objectKey) {
      reads.push({ type: 'head', objectKey });
      return object;
    },
  };
  return { env: { DB: db, ASSETS_BUCKET: bucket }, reads };
}

test('fallback path accepts tracked object keys and rejects traversal', () => {
  assert.equal(
    publicMediaFallbackObjectKey('media/asset-1/optimized/cover.webp'),
    'media/asset-1/optimized/cover.webp',
  );
  assert.equal(publicMediaFallbackObjectKey('../public/current.json'), null);
  assert.equal(publicMediaFallbackObjectKey('%2e%2e/public/current.json'), null);
  assert.equal(publicMediaFallbackObjectKey('media\\secret.webp'), null);
});

test('same-origin fallback streams only ready D1-tracked media from R2', async () => {
  const { env, reads } = createEnv();
  const response = await publicMediaFallbackRoutes.request(
    '/media/asset-1/optimized/cover.webp',
    {},
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.equal(response.headers.get('etag'), '"media-etag"');
  assert.equal(await response.text(), 'image-data');
  assert.deepEqual(reads, [
    { type: 'db', objectKey: 'media/asset-1/optimized/cover.webp' },
    { type: 'get', objectKey: 'media/asset-1/optimized/cover.webp', hasRange: false },
  ]);
});

test('same-origin fallback preserves byte ranges for video playback', async () => {
  const { env, reads } = createEnv({ partial: true });
  const response = await publicMediaFallbackRoutes.request(
    '/media/asset-1/original/clip.mp4',
    { headers: { range: 'bytes=2-5' } },
    env,
  );

  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(response.headers.get('content-length'), '4');
  assert.equal(reads.at(-1).hasRange, true);
});

test('untracked objects and malformed ranges never read R2', async () => {
  const untracked = createEnv({ tracked: false });
  const missing = await publicMediaFallbackRoutes.request(
    '/private/secret.json',
    {},
    untracked.env,
  );
  assert.equal(missing.status, 404);
  assert.equal(
    untracked.reads.some((entry) => entry.type === 'get'),
    false,
  );

  const invalid = createEnv();
  const badRange = await publicMediaFallbackRoutes.request(
    '/media/asset-1/original/clip.mp4',
    { headers: { range: 'bytes=0-1,4-5' } },
    invalid.env,
  );
  assert.equal(badRange.status, 416);
  assert.deepEqual(invalid.reads, []);
});
