import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORT_VISITOR_TTL_MS,
  generateSupportVisitorId,
  getSupportVisitorIdentity,
} from '../src/support-identity.ts';

test('support visitor ID always contains exactly three letters and three digits', () => {
  for (let index = 0; index < 200; index += 1) {
    const visitorId = generateSupportVisitorId();
    assert.equal(visitorId.length, 6);
    assert.match(visitorId, /^[A-Z0-9]{6}$/u);
    assert.equal(
      [...visitorId].filter((character) => /[A-Z]/u.test(character)).length,
      3,
    );
    assert.equal(
      [...visitorId].filter((character) => /[0-9]/u.test(character)).length,
      3,
    );
  }
});

test('support visitor identity expires after exactly 24 hours', () => {
  const now = 1_000_000;
  const identity = getSupportVisitorIdentity(now);
  assert.equal(SUPPORT_VISITOR_TTL_MS, 86_400_000);
  assert.equal(identity.expiresAt, now + SUPPORT_VISITOR_TTL_MS);

  const sameIdentity = getSupportVisitorIdentity(now + 10_000);
  assert.equal(sameIdentity.visitorId, identity.visitorId);
  assert.equal(sameIdentity.expiresAt, identity.expiresAt);

  const renewed = getSupportVisitorIdentity(identity.expiresAt + 1);
  assert.equal(renewed.expiresAt, identity.expiresAt + 1 + SUPPORT_VISITOR_TTL_MS);
});
