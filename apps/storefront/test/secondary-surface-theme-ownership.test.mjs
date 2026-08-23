import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('secondary app surfaces consume one Theme Center appearance contract', async () => {
  const [theme, faq, messages, conversation, pwa] = await Promise.all([
    readFile(
      new URL(
        '../../../packages/storefront-ui/src/primary-pages-theme-contract.css',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(new URL('../src/faq-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/messages-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/chat-conversation.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/pwa.css', import.meta.url), 'utf8'),
  ]);

  for (const token of [
    '--theme-primary-state-icon-shadow',
    '--theme-primary-message-workspace-shadow',
    '--theme-primary-message-avatar-shadow',
    '--theme-primary-message-active-marker',
    '--theme-primary-chat-header-shadow',
    '--theme-primary-chat-input-focus-ring',
    '--theme-primary-chat-send-shadow',
    '--theme-primary-install-shadow',
    '--theme-primary-install-icon-shadow',
    '--theme-primary-install-action-shadow',
  ]) {
    assert.match(theme, new RegExp(`${token}:`, 'u'));
  }

  assert.doesNotMatch(faq, /0 10px 30px/u);
  assert.doesNotMatch(faq, /0 8px 22px/u);
  assert.doesNotMatch(messages, /0 18px 48px/u);
  assert.doesNotMatch(messages, /0 5px 14px/u);
  assert.doesNotMatch(conversation, /0 4px 12px/u);
  assert.doesNotMatch(pwa, /0 18px 46px/u);
  assert.doesNotMatch(pwa, /0 8px 20px/u);

  assert.match(faq, /var\(--theme-primary-state-icon-shadow\)/u);
  assert.match(messages, /var\(--theme-primary-message-workspace-shadow\)/u);
  assert.match(messages, /var\(--theme-primary-chat-send-shadow\)/u);
  assert.match(conversation, /var\(--theme-primary-chat-header-shadow\)/u);
  assert.match(conversation, /var\(--theme-primary-chat-input-focus-ring\)/u);
  assert.match(pwa, /var\(--theme-primary-install-shadow\)/u);
  assert.match(pwa, /var\(--theme-primary-install-action-shadow\)/u);
});
