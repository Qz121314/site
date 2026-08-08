import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchMediaLibraryPage } from '../src/asset-library/media-library-page-api.ts';

function sampleAsset(overrides = {}) {
  return {
    id: 'asset-1',
    objectKey: 'media/asset-1/optimized/photo.webp',
    fileName: 'photo.webp',
    mimeType: 'image/webp',
    byteSize: 12345,
    mediaKind: 'image',
    width: 1200,
    height: 800,
    durationMs: null,
    folderId: 'folder-1',
    folderName: 'Product A',
    roles: ['product'],
    publicUrl: 'https://assets.example.com/media/asset-1/optimized/photo.webp',
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...overrides,
  };
}

async function withFetch(handler, run) {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  globalThis.fetch = handler;
  globalThis.window = {
    location: { href: 'https://admin.example.com/' },
    dispatchEvent() {},
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
}

test('paged media request sends server-side filters and cursor', async () => {
  let requestedUrl = '';
  await withFetch(
    async (input) => {
      requestedUrl = String(input);
      return Response.json({ assets: [sampleAsset()], nextCursor: 'cursor-2', total: 132 });
    },
    async () => {
      const page = await fetchMediaLibraryPage({
        kinds: ['image', 'animated_image'],
        role: 'product',
        folder: 'folder-1',
        query: 'hero image',
        cursor: 'cursor-1',
        limit: 80,
      });
      assert.equal(page.assets.length, 1);
      assert.equal(page.nextCursor, 'cursor-2');
      assert.equal(page.total, 132);
    },
  );

  const url = new URL(requestedUrl, 'https://admin.example.com');
  assert.equal(url.pathname, '/api/admin/assets/library/page');
  assert.equal(url.searchParams.get('kinds'), 'image,animated_image');
  assert.equal(url.searchParams.get('role'), 'product');
  assert.equal(url.searchParams.get('folder'), 'folder-1');
  assert.equal(url.searchParams.get('q'), 'hero image');
  assert.equal(url.searchParams.get('cursor'), 'cursor-1');
  assert.equal(url.searchParams.get('limit'), '80');
});

test('all-folder filter is omitted from the request', async () => {
  let requestedUrl = '';
  await withFetch(
    async (input) => {
      requestedUrl = String(input);
      return Response.json({ assets: [], nextCursor: null, total: 0 });
    },
    () => fetchMediaLibraryPage({ folder: 'all', query: '   ' }),
  );
  const url = new URL(requestedUrl, 'https://admin.example.com');
  assert.equal(url.searchParams.has('folder'), false);
  assert.equal(url.searchParams.has('q'), false);
});

test('invalid media page payload is rejected', async () => {
  await withFetch(
    async () => Response.json({ assets: [], nextCursor: 42, total: 0 }),
    async () => {
      await assert.rejects(
        () => fetchMediaLibraryPage(),
        (error) => error?.code === 'INVALID_RESPONSE',
      );
    },
  );
});

test('media page API errors preserve server message and code', async () => {
  await withFetch(
    async () => Response.json(
      { error: { code: 'MEDIA_LIBRARY_FAILED', message: '查询失败。' } },
      { status: 500 },
    ),
    async () => {
      await assert.rejects(
        () => fetchMediaLibraryPage(),
        (error) => error?.code === 'MEDIA_LIBRARY_FAILED' && error?.message === '查询失败。',
      );
    },
  );
});
