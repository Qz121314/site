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
  const conversationCss = source('../src/chat-conversation.css');

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
    conversationCss,
    /\.messages-push-host:has\(\.messages-workspace\.is-thread-open\) \.chat-page \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\) auto;[\s\S]*?overflow: hidden;/u,
  );
  assert.match(
    conversationCss,
    /\.messages-push-host:has\(\.messages-workspace\.is-thread-open\) \.chat-timeline \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;/u,
  );

  assert.match(
    keyboardAnchorRuntime,
    /\.messages-workspace\.is-thread-open \.chat-composer/u,
  );
  assert.match(keyboardAnchorRuntime, /\.chat-timeline/u);
  assert.match(keyboardAnchorRuntime, /document\.addEventListener\('focusin'/u);
  assert.match(keyboardAnchorRuntime, /document\.addEventListener\('focusout'/u);
  assert.match(keyboardAnchorRuntime, /window\.visualViewport/u);
  assert.match(
    keyboardAnchorRuntime,
    /visualViewport\?\.addEventListener\('resize', schedulePin/u,
  );
  assert.match(keyboardAnchorRuntime, /new ResizeObserver\(schedulePin\)/u);
  assert.match(
    keyboardAnchorRuntime,
    /target\.scrollTop = target\.scrollHeight;/u,
  );
  assert.doesNotMatch(keyboardAnchorRuntime, /behavior:\s*['"]smooth['"]/u);
});