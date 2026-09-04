import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile visitor composer stays above the keyboard inside the conversation owner', () => {
  const conversationCss = source('../src/chat-conversation.css');
  const iconButtonCss = source('../../../packages/storefront-ui/src/icon-button.css');

  assert.equal(conversationCss.includes('.chat-composer:focus-within'), false);
  assert.ok(conversationCss.includes('max(8px, env(safe-area-inset-bottom))'));
  assert.ok(conversationCss.includes('font-size: 16px;'));
  assert.ok(conversationCss.includes('field-sizing: content;'));
  assert.ok(conversationCss.includes('max-height: 108px;'));
  assert.ok(conversationCss.includes('grid-template-columns: 44px minmax(0, 1fr) 44px;'));
  assert.ok(conversationCss.includes('.chat-composer .storefront-icon-button'));
  assert.ok(iconButtonCss.includes('--storefront-icon-button-size: 44px;'));
});
