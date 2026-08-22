import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('support compose failures expose explicit retry without automatic side-effect retries', () => {
  const messages = source('../src/MessagesPage.tsx');
  const supportUi = source('../src/support-ui.tsx');
  const mediaCss = source('../src/messages-media.css');

  const handoffStart = messages.indexOf("queryKey: ['support-compose-handoff'");
  const handoffEnd = messages.indexOf('const resolvedComposeContext', handoffStart);
  const startStart = messages.indexOf("queryKey: ['support-compose-start'");
  const startEnd = messages.indexOf('const conversationsQuery', startStart);
  const handoffQuery = messages.slice(handoffStart, handoffEnd);
  const startQuery = messages.slice(startStart, startEnd);

  assert.ok(handoffStart >= 0);
  assert.ok(startStart >= 0);
  assert.ok(handoffQuery.includes('retry: false'));
  assert.ok(startQuery.includes('retry: false'));
  assert.ok(messages.includes('composeProductQuery.isError'));
  assert.ok(messages.includes('retryComposeConnection'));
  assert.ok(messages.includes('connectionError={'));
  assert.ok(messages.includes('onRetryConnection={'));

  assert.ok(supportUi.includes('connectionError = false'));
  assert.ok(supportUi.includes('onRetryConnection'));
  assert.ok(supportUi.includes('chat-connection-state is-error'));
  assert.ok(supportUi.includes('SYSTEM_UI.retry'));
  assert.ok(supportUi.includes('className="chat-delivery-halo"'));
  assert.equal(supportUi.includes('chat-status-spinner'), false);

  assert.ok(mediaCss.includes('.loading-halo.chat-delivery-halo'));
  assert.equal(mediaCss.includes('.chat-status-spinner'), false);
  assert.equal(mediaCss.includes('@keyframes chat-status-spin'), false);
});
