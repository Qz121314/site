import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const supportSource = await readFile(
  new URL('../src/support-ui.tsx', import.meta.url),
  'utf8',
);
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const routingSource = await readFile(
  new URL('../src/routing.ts', import.meta.url),
  'utf8',
);
const messagesCss = await readFile(
  new URL('../src/messages-ui.css', import.meta.url),
  'utf8',
);
const legacyPagesCss = await readFile(
  new URL('../src/storefront-pages.css', import.meta.url),
  'utf8',
);
const themeContractCss = await readFile(
  new URL(
    '../../../packages/storefront-ui/src/primary-pages-theme-contract.css',
    import.meta.url,
  ),
  'utf8',
);
const shellCss = await readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('Messages has no local search or visible ten-conversation capacity meter', () => {
  assert.doesNotMatch(supportSource, /conversation-capacity/u);
  assert.doesNotMatch(messagesCss, /\.conversation-capacity(?=[\s,{:.#>+~])/u);
  assert.doesNotMatch(legacyPagesCss, /\.conversation-capacity(?=[\s,{:.#>+~])/u);
  assert.doesNotMatch(themeContractCss, /\.conversation-capacity(?=[\s,{:.#>+~])/u);
  assert.doesNotMatch(supportSource, /type="search"|Search conversations/u);
  assert.doesNotMatch(supportSource, /conversations\.length\}\/10|of 10 conversations/u);
});

test('Messages keeps a minimal empty state and explains missing customer service', () => {
  assert.doesNotMatch(supportSource, /messages-page-heading|id="messages-title"/u);
  assert.doesNotMatch(supportSource, /messages\.emptyDescription|messages\.emptyTitle/u);
  assert.match(supportSource, /<div className="messages-empty-state" role="status">/u);
  assert.match(supportSource, /SYSTEM_UI\.noSupport/u);
  assert.doesNotMatch(messagesCss, /\.messages-page-heading/u);
  assert.match(messagesCss, /\.messages-empty-state strong/u);
});

test('Messages structural selectors have one dedicated stylesheet owner', () => {
  const structuralSelectors = [
    'messages-page',
    'messages-empty-state',
    'conversation-list',
    'conversation-row',
    'conversation-avatar',
    'chat-page',
    'chat-header',
    'chat-product-card',
    'chat-timeline',
    'chat-message-row',
    'chat-composer',
  ];

  for (const selector of structuralSelectors) {
    const selectorPattern = new RegExp(`\\.${selector}(?=[\\s,{:.#>+~])`, 'u');
    assert.match(
      messagesCss,
      selectorPattern,
      `${selector} must live in messages-ui.css`,
    );
    assert.doesNotMatch(
      legacyPagesCss,
      selectorPattern,
      `${selector} must not be duplicated in storefront-pages.css`,
    );
  }
});

test('conversation list is compact, newest-first, and keeps product context in the preview', () => {
  assert.match(supportSource, /orderedConversations = \[\.\.\.conversations\]\.sort/u);
  assert.match(
    supportSource,
    /conversationTimestamp\(right\) - conversationTimestamp\(left\)/u,
  );
  assert.match(supportSource, /`\$\{conversation\.productTitle\} · \$\{lastMessage\}`/u);
  assert.match(supportSource, /conversation\.unreadCount > 0/u);
  assert.match(supportSource, /SYSTEM_UI\.yesterday/u);
});

test('desktop Messages uses a two-pane conversation and chat workspace', () => {
  assert.match(supportSource, /messages-workspace/u);
  assert.match(supportSource, /threadOpen \? ' is-thread-open' : ''/u);
  assert.match(supportSource, /className="messages-sidebar"/u);
  assert.match(supportSource, /className="messages-detail"/u);
  assert.match(
    messagesCss,
    /@media \(min-width:\s*768px\)[\s\S]*\.messages-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(300px,\s*360px\) minmax\(0,\s*1fr\)/u,
  );
  assert.match(
    messagesCss,
    /@media \(min-width:\s*768px\)[\s\S]*\.chat-back-button\s*\{[\s\S]*display:\s*none/u,
  );
});

test('mobile opens a conversation as a dedicated chat view without global chrome', () => {
  assert.match(
    messagesCss,
    /@media \(max-width:\s*767px\)[\s\S]*\.messages-workspace\.is-thread-open \.messages-sidebar\s*\{[\s\S]*display:\s*none/u,
  );
  assert.match(
    shellCss,
    /@media \(max-width:\s*767px\)[\s\S]*\.app-shell:has\(\.messages-workspace\.is-thread-open\) > \.topbar/u,
  );
  assert.match(
    shellCss,
    /\.app-shell:has\(\.messages-workspace\.is-thread-open\) > \.bottom-nav/u,
  );
  assert.match(shellCss, /height:\s*100dvh/u);
});

test('Messages routes through the primary shell and shares Theme Center semantic variables', () => {
  assert.match(mainSource, /\.\/messages-ui\.css/u);
  assert.match(rootSource, /function MessagesPage\(/u);
  assert.match(rootSource, /<MessagesWorkspace/u);
  assert.match(
    rootSource,
    /case 'messages':[\s\S]*?<MessagesPage[\s\S]*?activeConversationRef=\{null\}/u,
  );
  assert.match(
    rootSource,
    /case 'message-compose':[\s\S]*?<MessagesPage[\s\S]*?compose/u,
  );
  assert.match(
    rootSource,
    /case 'message':[\s\S]*?<MessagesPage[\s\S]*?activeConversationRef=\{route\.conversationRef\}/u,
  );
  assert.equal(rootSource.match(/<PrimaryShell\b/gu)?.length, 1);
  assert.match(routingSource, /pathname === '\/messages\/new'/u);
  assert.match(messagesCss, /var\(--surface\)/u);
  assert.match(messagesCss, /var\(--brand\)/u);
  assert.match(messagesCss, /var\(--line\)/u);
  assert.doesNotMatch(messagesCss, /#25d366|#075e54|#128c7e/iu);
});
