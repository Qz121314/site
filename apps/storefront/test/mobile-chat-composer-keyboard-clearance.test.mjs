import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile visitor composer stays above the keyboard inside the flex thread', () => {
  const css = source('../src/mobile-fixed-surfaces.css');
  const conversationCss = source('../src/chat-conversation.css');

  assert.equal(css.includes('.chat-composer:focus-within'), false);
  assert.ok(css.includes('padding-bottom: max(8px, env(safe-area-inset-bottom));'));
  assert.ok(css.includes('flex: 0 0 auto;'));
  assert.ok(conversationCss.includes('font-size: 16px;'));
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
