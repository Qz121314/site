import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile visitor chat uses one CSS viewport model owned by the shell and conversation', () => {
  const html = source('../index.html');
  const main = source('../src/main.tsx');
  const appShell = source('../src/app-shell.css');
  const conversationCss = source('../src/chat-conversation.css');

  assert.ok(html.includes('viewport-fit=cover'));
  assert.equal(html.includes('interactive-widget='), false);
  assert.equal(main.includes('mobile-chat-viewport'), false);
  assert.equal(main.includes('installMobileChatViewportRuntime'), false);
  assert.equal(main.includes('mobile-fixed-surfaces.css'), false);

  assert.match(
    appShell,
    /\.app-shell:has\(\.messages-workspace\.is-thread-open\) > main \{[\s\S]*?height: 100dvh;[\s\S]*?padding: 0;/u,
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
});
