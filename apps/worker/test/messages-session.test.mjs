import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createConversationRef,
  createMessageVisitorToken,
  parseConversationRef,
  verifyMessageVisitorToken,
} from '../src/messages/messages-session.ts';

const secret = 'messages-session-secret-that-is-long-enough-for-tests';

test('visitor session tokens are signed and expire', async () => {
  const now = Date.UTC(2026, 7, 9, 12, 0, 0);
  const created = await createMessageVisitorToken(secret, 'visitor-1234567890', now);
  assert.equal((await verifyMessageVisitorToken(created.token, secret, now))?.visitorId, 'visitor-1234567890');
  assert.equal(await verifyMessageVisitorToken(`${created.token}x`, secret, now), null);
  assert.equal(
    await verifyMessageVisitorToken(created.token, secret, now + 181 * 24 * 60 * 60 * 1000),
    null,
  );
});

test('conversation refs are encrypted and bound to one visitor', async () => {
  const ref = await createConversationRef(
    secret,
    'visitor-1234567890',
    'connection-secret-id',
    'remote-conversation-secret-id',
  );
  assert.doesNotMatch(ref, /connection-secret-id|remote-conversation-secret-id/u);
  assert.deepEqual(
    await parseConversationRef(secret, 'visitor-1234567890', ref),
    {
      connectionId: 'connection-secret-id',
      remoteConversationId: 'remote-conversation-secret-id',
    },
  );
  assert.equal(await parseConversationRef(secret, 'visitor-other-123456', ref), null);
});
