import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile visitor chat inherits the shared visual viewport owned by App Shell', () => {
  const html = source('../index.html');
  const main = source('../src/main.tsx');
  const viewportRuntime = source('../src/storefront-viewport-runtime.ts');
  const keyboardAnchorRuntime = source('../src/chat-keyboard-anchor-runtime.ts');
  const appShell = source('../src/app-shell.css');
  const messagesUi = source('../src/messages-ui.css');
  const conversationCss = source('../src/chat-conversation.css');
  const messagesMedia = source('../src/messages-media.css');

  assert.ok(html.includes('viewport-fit=cover'));
  assert.ok(html.includes('interactive-widget=resizes-content'));
  assert.match(main, /installStorefrontViewportRuntime/u);
  assert.match(main, /installChatKeyboardAnchorRuntime/u);
  assert.match(viewportRuntime, /window\.visualViewport/u);
  assert.equal(main.includes('mobile-chat-viewport'), false);
  assert.equal(main.includes('installMobileChatViewportRuntime'), false);
  assert.equal(main.includes('mobile-fixed-surfaces.css'), false);

  assert.match(
    appShell,
    /\.app-shell:has\(\.messages-workspace\.is-thread-open\) > main \{[\s\S]*?height: var\(--app-viewport-height, 100dvh\);[\s\S]*?padding: 0;/u,
  );
  assert.match(
    conversationCss,
    /\.messages-push-host:has\(\.messages-workspace\.is-thread-open\)[\s\S]*?height: 100%;[\s\S]*?min-height: 0;/u,
  );
  assert.match(
    messagesUi,
    /\.chat-page \{[\s\S]*?display: flex;[\s\S]*?min-height: 0;[\s\S]*?flex-direction: column;[\s\S]*?overflow: hidden;/u,
  );
  assert.match(
    messagesUi,
    /\.chat-timeline \{[\s\S]*?min-height: 0;[\s\S]*?flex: 1 1 0;[\s\S]*?overflow-y: auto;/u,
  );
  assert.match(
    conversationCss,
    /\.messages-push-host:has\(\.messages-workspace\.is-thread-open\) \.chat-timeline \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;/u,
  );
  assert.doesNotMatch(
    conversationCss,
    /\.messages-push-host:has\(\.messages-workspace\.is-thread-open\) \.chat-page \{[\s\S]*?grid-template-rows:/u,
  );
  assert.doesNotMatch(
    messagesMedia,
    /\.chat-page:has\(\.chat-conversation-status\)[\s\S]*?grid-template-rows:/u,
  );

  for (const pattern of [
    /\.messages-workspace\.is-thread-open \.chat-composer/u,
    /\.chat-timeline/u,
    /document\.addEventListener\('focusin'/u,
    /document\.addEventListener\('focusout'/u,
    /window\.visualViewport/u,
    /visualViewport\?\.addEventListener\('resize', schedulePin/u,
    /new ResizeObserver\(schedulePin\)/u,
    /target\.scrollTop = target\.scrollHeight;/u,
  ]) {
    assert.match(keyboardAnchorRuntime, pattern);
  }
  assert.doesNotMatch(keyboardAnchorRuntime, /behavior:\s*['"]smooth['"]/u);
});
