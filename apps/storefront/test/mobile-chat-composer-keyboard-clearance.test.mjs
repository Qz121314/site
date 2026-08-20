import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile visitor composer stays above the keyboard inside the conversation owner', () => {
  const conversationCss = source('../src/chat-conversation.css');

  assert.equal(conversationCss.includes('.chat-composer:focus-within'), false);
  assert.ok(conversationCss.includes('max(8px, env(safe-area-inset-bottom))'));
  assert.ok(conversationCss.includes('font-size: 16px;'));
  assert.ok(conversationCss.includes('field-sizing: content;'));
  assert.ok(conversationCss.includes('max-height: 108px;'));
  assert.match(
    conversationCss,
    /\.chat-composer \.chat-send-button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/u,
  );
});
