import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('support lifecycle keeps side-effect retries explicit and realtime recovery automatic', () => {
  const ui = source('../src/support-ui.tsx');
  const messages = source('../src/MessagesPage.tsx');
  const realtime = source('../src/support-realtime.ts');

  const handoffStart = messages.indexOf("queryKey: ['support-compose-handoff'");
  const handoffEnd = messages.indexOf('const resolvedComposeContext', handoffStart);
  const startStart = messages.indexOf("queryKey: ['support-compose-start'");
  const startEnd = messages.indexOf('const conversationsQuery', startStart);
  const handoffQuery = messages.slice(handoffStart, handoffEnd);
  const startQuery = messages.slice(startStart, startEnd);

  assert.ok(handoffStart >= 0);
  assert.ok(startStart >= 0);
  assert.match(handoffQuery, /retry: false/u);
  assert.match(startQuery, /retry: false/u);
  assert.match(messages, /retryComposeConnection/u);

  assert.match(ui, /status === 'waiting'/u);
  assert.match(ui, /SYSTEM_UI\.waitingForSupport/u);
  assert.match(ui, /SYSTEM_UI\.conversationClosed/u);

  assert.match(realtime, /recovered \? 'realtime\.recovered' : 'realtime\.connected'/u);
  assert.match(realtime, /scheduleReconnect\(state\)/u);
  assert.match(realtime, /SOCKET_HEARTBEAT_MS/u);
  assert.match(realtime, /SOCKET_STALE_MS/u);
});
