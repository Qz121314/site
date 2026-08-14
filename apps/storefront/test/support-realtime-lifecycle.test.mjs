import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const realtimeSource = await readFile(
  new URL('../src/support-realtime.ts', import.meta.url),
  'utf8',
);
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const messagesPageSource = await readFile(
  new URL('../src/MessagesPage.tsx', import.meta.url),
  'utf8',
);

test('support realtime survives route transitions and reconnects with catch-up', () => {
  assert.match(realtimeSource, /SOCKET_STOP_GRACE_MS/u);
  assert.match(realtimeSource, /realtime\.connected/u);
  assert.match(realtimeSource, /visibilitychange/u);
  assert.match(rootSource, /subscribeSupportRealtime/u);
  assert.match(rootSource, /event\.conversationRef/u);
  assert.match(
    rootSource,
    /queryKey: \['support-conversation', event\.conversationRef\]/u,
  );
  assert.doesNotMatch(messagesPageSource, /subscribeSupportRealtime/u);
});
