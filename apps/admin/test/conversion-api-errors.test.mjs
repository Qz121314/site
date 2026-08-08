import assert from 'node:assert/strict';
import test from 'node:test';
import { updateConversionGroup } from '../src/conversion-pool/api.ts';

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

test('conversion API errors preserve field and dependency counts', async () => {
  await withBrowserFetch(
    async () =>
      Response.json(
        {
          error: {
            code: 'CONVERSION_GROUP_HAS_DEPENDENCIES',
            message: '转化分组仍有依赖。',
            details: {
              field: 'mode',
              productCount: 3,
              targetCount: 2,
            },
          },
        },
        { status: 409 },
      ),
    async () => {
      await assert.rejects(
        () =>
          updateConversionGroup('section-1', 'group-1', {
            name: '默认分组',
            mode: 'link',
            buttonLabel: 'Open',
            sortOrder: 0,
            isEnabled: true,
          }),
        (error) =>
          error?.code === 'CONVERSION_GROUP_HAS_DEPENDENCIES' &&
          error?.message === '转化分组仍有依赖。' &&
          error?.field === 'mode' &&
          error?.productCount === 3 &&
          error?.targetCount === 2,
      );
    },
  );
});
