import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [page, root, mediaCss] = await Promise.all([
  readFile(new URL('../src/MessagesPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/messages-media.css', import.meta.url), 'utf8'),
]);

test('text messages render optimistically instead of waiting for a refetch', () => {
  assert.match(page, /appendOptimisticMessage/u);
  assert.match(page, /delivery: 'sending'/u);
  assert.match(page, /replaceOptimisticMessage/u);
  assert.match(page, /clientMessageId: crypto\.randomUUID\(\)/u);
  assert.match(page, /sending=\{compose && sendMutation\.isPending\}/u);
});

test('new conversations also show the first outgoing message immediately', () => {
  assert.match(page, /composeOptimisticMessage/u);
  assert.match(page, /optimisticComposeConversation/u);
  assert.match(page, /messages: \[composeOptimisticMessage\]/u);
});

test('image selection gives immediate local feedback before compression and upload finish', () => {
  assert.match(page, /const previewUrl = URL\.createObjectURL\(file\)/u);
  assert.match(page, /setImagePreviewUrl\(previewUrl\)/u);
  assert.match(page, /setImageProgress\(0\)/u);
  assert.match(mediaCss, /chat-upload-preview-in/u);
  assert.match(mediaCss, /justify-self: end/u);
});

test('unread state is global and survives leaving the Messages route', () => {
  assert.match(root, /queryKey: \['support-conversations'\]/u);
  assert.match(root, /refetchOnWindowFocus: true/u);
  assert.match(root, /refetchInterval: 30_000/u);
  assert.match(root, /subscribeSupportRealtime/u);
  assert.match(root, /syncSupportAppBadge\(unreadMessages\)/u);
  assert.match(root, /unreadMessages=\{unreadMessages\}/u);
  assert.doesNotMatch(page, /onUnreadMessagesChange/u);
  assert.doesNotMatch(page, /subscribeSupportRealtime/u);
});
