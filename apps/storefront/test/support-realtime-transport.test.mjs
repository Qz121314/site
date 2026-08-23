import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('support realtime is websocket-first with REST reserved for recovery', () => {
  const root = source('../src/StorefrontRoot.tsx');
  const runtime = source('../src/StorefrontSupportRuntime.tsx');
  const realtime = source('../src/support-realtime.ts');
  const messages = source('../src/MessagesPage.tsx');
  const media = source('../src/support-media-gateway.ts');
  const typing = source('../src/support-thread-realtime.ts');

  assert.ok(!runtime.includes('refetchInterval: 30_000'));
  assert.ok(runtime.includes("event.type === 'realtime.recovered'"));
  assert.ok(runtime.includes('setQueryData'));
  assert.ok(root.includes('Boolean(peekSupportVisitorIdentity())'));
  assert.ok(root.includes("import('./StorefrontSupportRuntime')"));
  assert.ok(root.includes("conversationListEnabled={route.type !== 'message-compose'}"));
  assert.ok(runtime.includes('enabled: conversationListEnabled'));
  assert.ok(runtime.includes('return subscribeSupportRealtime((event) =>'));
  assert.ok(realtime.includes("recovered ? 'realtime.recovered' : 'realtime.connected'"));
  assert.ok(realtime.includes('parseMessage(state.connection, raw.message, raw.media)'));
  assert.ok(messages.includes('staleTime: Number.POSITIVE_INFINITY'));
  assert.ok(
    !messages.includes("invalidateQueries({ queryKey: ['support-conversations'] })"),
  );
  assert.ok(media.includes('Promise<SupportMessage>'));
  assert.ok(typing.includes("socket.send(JSON.stringify({ type: 'typing', active }))"));
  assert.ok(typing.includes('buildSupportConversationWebSocketUrl'));
});
