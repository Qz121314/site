import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMobileChatViewportMetrics } from '../src/mobile-chat-viewport.ts';

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
