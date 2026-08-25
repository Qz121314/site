import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('conversation lifecycle, image retry and realtime recovery stay explicit', () => {
  const ui = source('../src/support-ui.tsx');
  const messages = source('../src/MessagesPage.tsx');
  const realtime = source('../src/support-realtime.ts');
  const systemUi = source('../src/system-ui.ts');

  assert.ok(ui.includes('function ConversationStatusNotice'));
  assert.ok(ui.includes("status === 'waiting' ? SYSTEM_UI.waitingForSupport"));
  assert.ok(ui.includes('SYSTEM_UI.conversationClosed'));
  assert.ok(ui.includes("conversation?.status !== 'closed'"));
  assert.ok(systemUi.includes("waitingForSupport: 'Waiting for customer service'"));
  assert.ok(systemUi.includes("conversationClosed: 'Conversation closed'"));

  assert.ok(messages.includes('async function retryImage()'));
  assert.ok(messages.includes('const variables = imageMutation.variables'));
  assert.ok(messages.includes('imageMutation.mutateAsync(variables)'));
  assert.ok(
    messages.includes('imageFailed={imageMutation.isError && Boolean(imagePreviewUrl)}'),
  );
  assert.ok(messages.includes('onRetryImage={'));

  assert.ok(realtime.includes("recovered ? 'realtime.recovered' : 'realtime.connected'"));
  assert.ok(realtime.includes('scheduleReconnect(state);'));
  assert.ok(realtime.includes('SOCKET_HEARTBEAT_MS'));
  assert.ok(realtime.includes('SOCKET_STALE_MS'));
});
