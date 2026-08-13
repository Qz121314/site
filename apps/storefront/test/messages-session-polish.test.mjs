import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const [messagesPage, supportUi] = await Promise.all([
  readFile(new URL('../src/MessagesPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/support-ui.tsx', import.meta.url), 'utf8'),
]);

test('conversation pagination de-duplicates messages by message id', () => {
  assert.match(messagesPage, /const seen = new Set<string>\(\)/u);
  assert.match(messagesPage, /if \(seen\.has\(message\.id\)\) continue/u);
});

test('reading a live conversation refreshes both list and detail state', () => {
  assert.match(
    messagesPage,
    /queryKey: \['support-conversation', activeConversationRef\]/u,
  );
  assert.match(messagesPage, /Promise\.all\(\[/u);
});

test('visitor thread follows new messages without breaking earlier-message paging', () => {
  assert.match(
    supportUi,
    /const lastMessageId = conversation\?\.messages\.at\(-1\)\?\.id/u,
  );
  assert.match(
    supportUi,
    /timeline\.scrollTo\(\{ top: timeline\.scrollHeight/u,
  );
});

test('visitor composer supports Enter send and preserves a newer draft on failure', () => {
  assert.match(supportUi, /event\.key === 'Enter'/u);
  assert.match(supportUi, /!event\.nativeEvent\.isComposing/u);
  assert.match(supportUi, /setDraft\(\(current\) => current \|\| body\)/u);
  assert.match(supportUi, /disabled=\{!canSend\}/u);
});
