import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile visitor composer stays prominent inside the keyboard-resized chat surface', () => {
  const css = source('../src/mobile-fixed-surfaces.css');
  const runtime = source('../src/mobile-chat-viewport.ts');

  assert.equal(css.includes('.chat-composer:focus-within'), false);
  assert.ok(css.includes('padding-bottom: calc(10px + env(safe-area-inset-bottom));'));
  assert.equal(runtime.includes('MOBILE_CHAT_KEYBOARD_CLEARANCE_PX'), false);
  assert.equal(runtime.includes('resolveMobileChatSurfaceHeight'), false);
  assert.ok(
    css.includes('border: 2px solid color-mix(in srgb, var(--brand) 54%, var(--line));'),
  );
  assert.ok(css.includes('.chat-attachment-picker,'));
  assert.ok(css.includes('color: var(--brand-strong);'));
  assert.ok(
    css.includes('background: color-mix(in srgb, var(--brand) 12%, var(--surface));'),
  );
  assert.ok(css.includes('.chat-send-button:disabled'));
  assert.ok(css.includes('opacity: 0.68;'));
});
