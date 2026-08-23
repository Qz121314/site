import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('ordinary storefront startup keeps support runtime behind route or identity activation', () => {
  const main = source('../src/main.tsx');
  const root = source('../src/StorefrontRoot.tsx');
  const messages = source('../src/MessagesPage.tsx');
  const expiry = source('../src/support-expiry-runtime.ts');
  const runtime = source('../src/StorefrontSupportRuntime.tsx');

  assert.equal(main.includes("from './support-expiry-runtime'"), false);
  assert.equal(main.includes('installSupportExpiryRuntime();'), false);
  assert.ok(messages.includes("from './support-expiry-runtime'"));
  assert.ok(messages.includes('installSupportExpiryRuntime();'));

  assert.equal(root.includes("from './support-gateway'"), false);
  assert.equal(root.includes("from './support-realtime'"), false);
  assert.ok(root.includes("import('./StorefrontSupportRuntime')"));
  assert.ok(root.includes('Boolean(peekSupportVisitorIdentity())'));

  assert.equal(
    expiry.includes("import { siteSupportGateway } from './support-gateway';"),
    false,
  );
  assert.ok(expiry.includes("import('./support-gateway')"));
  assert.ok(
    expiry.indexOf('const conversationRef = activeConversationRef();') <
      expiry.indexOf('const siteSupportGateway = await loadSupportGateway();'),
  );

  assert.ok(runtime.includes("from './support-gateway'"));
  assert.ok(runtime.includes("from './support-realtime'"));
});
