import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

// These source contracts keep route-level cache ownership explicit so later UI work
// cannot silently reintroduce duplicate public reads on the primary storefront path.
test('home and section surfaces share the canonical section query cache', () => {
  const home = source('../src/HomeFeed.tsx');
  const section = source('../src/SectionPage.tsx');

  assert.equal(home.includes('storefront-home-recommendation'), false);
  assert.ok(
    home.includes("['storefront-section', bootstrap.pointer.contentVersion, section.id]"),
  );
  assert.ok(section.includes('const canonicalSectionId ='));
  assert.ok(section.includes('canonicalSectionId,'));
});

test('support connection discovery deduplicates cold concurrent consumers and compose skips list fetch', () => {
  const gateway = source('../src/support-gateway.ts');
  const root = source('../src/StorefrontRoot.tsx');

  assert.ok(
    gateway.includes(
      'let connectionRequest: Promise<PublicSupportConnection[]> | null = null;',
    ),
  );
  assert.ok(gateway.includes('if (!connectionRequest)'));
  assert.ok(gateway.includes("'/api/public/storefront/support/connections'"));
  assert.ok(gateway.includes('return connectionRequest;'));
  assert.ok(root.includes("supportRuntimeEnabled && route.type !== 'message-compose'"));
  assert.ok(root.includes('enabled: supportConversationListEnabled'));
});

test('product detail and compose reuse one versioned immutable product cache', () => {
  const detail = source('../src/ProductDetailPage.tsx');
  const messages = source('../src/MessagesPage.tsx');

  assert.equal(detail.includes('support-compose-product'), false);
  assert.equal(messages.includes('support-compose-product'), false);
  assert.ok(detail.includes("'storefront-product',"));
  assert.ok(detail.includes('bootstrap.pointer.contentVersion,'));
  assert.ok(messages.includes("'storefront-product',"));
  assert.ok(messages.includes('bootstrap.pointer.contentVersion,'));
  assert.ok(detail.includes('gcTime: 30 * 60_000'));
  assert.ok(messages.includes('gcTime: 30 * 60_000'));
});
