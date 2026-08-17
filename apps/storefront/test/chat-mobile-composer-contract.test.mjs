import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront mobile chat composer uses stable keyboard-safe geometry', () => {
  const css = source('../src/chat-conversation.css');

  assert.ok(css.includes('box-sizing: border-box;'));
  assert.ok(css.includes('height: 44px;'));
  assert.ok(css.includes('min-height: 44px;'));
  assert.ok(css.includes('max-height: 108px;'));
  assert.ok(css.includes('font-size: 16px;'));
  assert.ok(css.includes('field-sizing: content;'));
  assert.ok(css.includes('max(8px, env(safe-area-inset-bottom))'));
});
