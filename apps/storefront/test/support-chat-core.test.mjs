import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  applyRealtimeToConversationCache,
  failSupportMessage,
  mergeSupportConversation,
  normalizeSupportConversation,
  replaceSupportMessage,
  upsertSupportMessage,
} from '../src/support-realtime-cache.ts';

const message = (id, direction = 'agent', delivery = 'sent', body = id) => ({
  id,
  direction,
  body,
  kind: 'text',
  productContext: null,
  sentAt: `2026-01-01T00:00:${id === 'agent-1' ? '01' : '02'}.000Z`,
  delivery,
  attachments: [],
});

const conversation = (messages = [message('agent-1')]) => ({
  id: 'connection:conversation-1',
  agentName: 'Agent',
  agentAvatarUrl: null,
  productTitle: 'Product',
  productCoverUrl: null,
  lastMessage: messages.at(-1)?.body ?? null,
  lastMessageAt: messages.at(-1)?.sentAt ?? null,
  unreadCount: 1,
  status: 'active',
  productId: 'product-1',
  sectionId: 'section-1',
  productHref: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-02T00:00:00.000Z',
  messages,
  nextMessageCursor: 'cursor-1',
});

test('Messages and Landing share one normalized conversation cache shape', () => {
  const first = normalizeSupportConversation(conversation());
  const merged = mergeSupportConversation(
    first,
    conversation([message('visitor-1', 'customer', 'sent', 'hello')]),
  );
  assert.deepEqual(
    merged.messages.map(({ id }) => id),
    ['agent-1', 'visitor-1'],
  );
  assert.equal(merged.nextMessageCursor, 'cursor-1');
  assert.equal(Array.isArray(merged.pages), false);
});

test('pagination cursor reaches a terminal null instead of reopening the prior page', () => {
  const first = conversation();
  const terminal = { ...conversation([message('agent-2')]), nextMessageCursor: null };
  const merged = mergeSupportConversation(first, terminal);
  assert.equal(merged.nextMessageCursor, null);
});

test('shared realtime updates message, status, agent, unread and read state', () => {
  const current = conversation([message('agent-1'), message('visitor-1', 'customer')]);
  const next = applyRealtimeToConversationCache(current, {
    type: 'conversation.updated',
    connectionId: 'connection',
    conversationRef: current.id,
    conversation: { ...current, agentName: 'New Agent', unreadCount: 3 },
    message: message('agent-2', 'agent', 'sent', 'new message'),
    reader: null,
    lastMessageId: null,
  });
  assert.equal(next.agentName, 'New Agent');
  assert.equal(next.unreadCount, 3);
  assert.deepEqual(
    next.messages.map(({ id }) => id),
    ['agent-1', 'visitor-1', 'agent-2'],
  );

  const read = applyRealtimeToConversationCache(next, {
    type: 'message.read',
    connectionId: 'connection',
    conversationRef: current.id,
    conversation: null,
    message: null,
    reader: 'agent',
    lastMessageId: 'visitor-1',
  });
  assert.equal(read.messages.find(({ id }) => id === 'visitor-1').delivery, 'read');
});

test('shared send transitions cover optimistic, success replacement and retry failure', () => {
  const current = conversation([]);
  const optimistic = message('local:client-1', 'customer', 'sending', 'hello');
  const pending = upsertSupportMessage(current, optimistic);
  assert.equal(pending.messages[0].delivery, 'sending');
  const sent = replaceSupportMessage(
    pending,
    optimistic.id,
    message('server-1', 'customer', 'sent', 'hello'),
  );
  assert.equal(sent.messages[0].id, 'server-1');
  const failed = failSupportMessage(pending, optimistic.id);
  assert.equal(failed.messages[0].delivery, 'failed');
});

test('realtime recovery keeps the normalized cache eligible for a REST refresh', () => {
  const current = conversation();
  const recovered = applyRealtimeToConversationCache(current, {
    type: 'realtime.recovered',
    connectionId: 'connection',
    conversationRef: current.id,
    conversation: null,
    message: null,
    reader: null,
    lastMessageId: null,
  });
  assert.deepEqual(recovered, current);
});

test('recovery is handled before conversation filtering for the real null-ref event shape', () => {
  const core = readFileSync(
    new URL('../src/support-chat-core.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    core.indexOf("event.type === 'realtime.recovered'") <
      core.indexOf('event.conversationRef !== activeRef'),
  );
  assert.match(
    core,
    /refetchQueries\(\{\s*queryKey: \['support-conversation', activeRef\]/u,
  );
});
