import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';
import {
  resolveMobileChatViewportMetrics,
  shouldUseMobileChatVisualViewportFallback,
} from '../src/mobile-chat-viewport.ts';

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

test('mobile chat prefers native layout viewport resize and only falls back when needed', () => {
  assert.equal(shouldUseMobileChatVisualViewportFallback(524, 524), false);
  assert.equal(shouldUseMobileChatVisualViewportFallback(523.6, 524), false);
  assert.equal(shouldUseMobileChatVisualViewportFallback(524, 844), true);
});

test('mobile chat uses one viewport height source for the full nested route', () => {
  const html = source('../index.html');
  const runtime = source('../src/mobile-chat-viewport.ts');
  const fixedSurfaces = source('../src/mobile-fixed-surfaces.css');

  assert.ok(html.includes('interactive-widget=resizes-content'));
  assert.ok(runtime.includes("main: page.closest<HTMLElement>('main')"));
  assert.ok(
    runtime.includes("pushHost: page.closest<HTMLElement>('.messages-push-host')"),
  );
  assert.ok(runtime.includes('document.documentElement.clientHeight'));
  assert.ok(runtime.includes('needsVisualViewportFallback'));
  assert.ok(runtime.includes('clearOuterViewportStyles(main)'));
  assert.ok(runtime.includes('main.style.height = `${viewportHeight}px`'));
  assert.equal(runtime.includes('MOBILE_CHAT_KEYBOARD_CLEARANCE_PX'), false);
  assert.equal(runtime.includes('resolveMobileChatSurfaceHeight'), false);
  assert.equal(runtime.includes('element.style.height = height'), false);
  assert.ok(runtime.includes('clearNestedViewportStyles(nextSurfaces)'));
  assert.ok(runtime.includes('translate3d(0, ${offsetTop}px, 0)'));
  assert.ok(fixedSurfaces.includes('.messages-push-host,'));
  assert.ok(fixedSurfaces.includes('height: 100%;'));
  assert.ok(fixedSurfaces.includes('min-height: 0;'));
});
