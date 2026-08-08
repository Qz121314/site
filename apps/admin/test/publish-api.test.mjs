import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPublishStatus, publishStorefront } from '../src/publish-api.ts';

async function withBrowserFetch(handler, run) {
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

function statusEnvelope() {
  return {
    status: {
      pointerVersion: null,
      publishedAt: null,
      isCurrent: false,
      dirtyCount: 1,
      bootstrapRequired: true,
      legacyPointerDetected: false,
      contentOrigin: null,
      modules: [
        {
          key: 'site',
          kind: 'site',
          sectionId: null,
          label: '站点基础',
          currentVersion: null,
          publishedAt: null,
          isCurrent: false,
          versions: [],
          lastJob: null,
        },
      ],
    },
  };
}

test('publish status validates the response and uses authenticated no-cache reads', async () => {
  await withBrowserFetch(
    async (requestPath, init) => {
      assert.equal(requestPath, '/api/admin/publish/');
      assert.equal(init.credentials, 'same-origin');
      assert.equal(init.cache, 'no-store');
      return Response.json(statusEnvelope());
    },
    async () => {
      const status = await fetchPublishStatus();
      assert.equal(status.bootstrapRequired, true);
      assert.equal(status.modules[0]?.key, 'site');
    },
  );
});

test('concurrent publish status reads share one worker request', async () => {
  let requestCount = 0;
  let releaseRequest;
  const gate = new Promise((resolve) => {
    releaseRequest = resolve;
  });

  await withBrowserFetch(
    async () => {
      requestCount += 1;
      await gate;
      return Response.json(statusEnvelope());
    },
    async () => {
      const first = fetchPublishStatus();
      const second = fetchPublishStatus();
      assert.equal(first, second);
      assert.equal(requestCount, 1);

      releaseRequest();
      await Promise.all([first, second]);

      await fetchPublishStatus();
      assert.equal(requestCount, 2);
    },
  );
});

test('publish status rejects malformed successful responses', async () => {
  await withBrowserFetch(
    async () => Response.json({ status: { modules: [] } }),
    async () => {
      await assert.rejects(
        () => fetchPublishStatus(),
        (error) => error?.code === 'INVALID_RESPONSE' && error?.status === 500,
      );
    },
  );
});

test('publish API preserves server error codes and messages', async () => {
  await withBrowserFetch(
    async () =>
      Response.json(
        { error: { code: 'PUBLISH_CONFLICT', message: '当前发布任务仍在执行。' } },
        { status: 409 },
      ),
    async () => {
      await assert.rejects(
        () => publishStorefront('site'),
        (error) =>
          error?.code === 'PUBLISH_CONFLICT' &&
          error?.status === 409 &&
          error?.message === '当前发布任务仍在执行。',
      );
    },
  );
});
