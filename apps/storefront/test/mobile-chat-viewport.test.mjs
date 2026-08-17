import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';
import { resolveMobileChatViewportMetrics } from '../src/mobile-chat-viewport.ts';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile chat viewport follows the visual viewport height and vertical offset', () => {
  assert.deepEqual(
    resolveMobileChatViewportMetrics(
      {
        height: 523.6,
        offsetTop: 188.4,
      },
      844,
    ),
    {
      height: 524,
      offsetTop: 188,
    },
  );
});

test('mobile chat viewport falls back to the layout viewport and never shifts upward', () => {
  assert.deepEqual(resolveMobileChatViewportMetrics(null, 844.4), {
    height: 844,
    offsetTop: 0,
  });

  assert.deepEqual(
    resolveMobileChatViewportMetrics(
      {
        height: 640,
        offsetTop: -12,
      },
      844,
    ),
    {
      height: 640,
      offsetTop: 0,
    },
  );
});

test('mobile chat keeps the whole route on the keyboard-resized viewport', () => {
  const html = source('../index.html');
  const runtime = source('../src/mobile-chat-viewport.ts');

  assert.ok(html.includes('interactive-widget=resizes-content'));
  assert.ok(runtime.includes("main: page.closest<HTMLElement>('main')"));
  assert.ok(runtime.includes('.storefront-route-view'));
  assert.ok(runtime.includes('main, route, workspace, detail, page'));
  assert.ok(runtime.includes("workspace?.style.removeProperty('transform')"));
  assert.ok(runtime.includes('translate3d(0, ${offsetTop}px, 0)'));
});
