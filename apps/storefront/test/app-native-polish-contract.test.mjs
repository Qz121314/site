import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Storefront fallback, FAQ, and Messages surfaces stay app-native', async () => {
  const [rootSource, faqSource, faqStyles, messagesStyles, globalStyles] = await Promise.all([
    readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/FaqPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/faq-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/messages-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(rootSource, /site-footer/u);
  assert.match(faqSource, /faq-empty-state/u);
  assert.match(faqStyles, /\.faq-empty-state/u);
  assert.match(faqStyles, /\.faq-article-body/u);
  assert.match(messagesStyles, /\.conversation-list/u);
  assert.match(messagesStyles, /\.chat-message-bubble/u);
  assert.match(messagesStyles, /\.chat-composer/u);
  assert.match(globalStyles, /\.state-mark svg/u);
});
