import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront resolves and prefers the assigned customer-service agent avatar', () => {
  const contract = source('../src/support-contract.ts');
  const gateway = source('../src/support-gateway.ts');
  const realtime = source('../src/support-realtime.ts');
  const ui = source('../src/support-ui.tsx');
  const css = source('../src/messages-ui.css');

  assert.ok(contract.includes('agentAvatarUrl: string | null'));
  assert.ok(gateway.includes('resolveSupportAssetUrl'));
  assert.ok(gateway.includes('agentAvatarUrl: resolveSupportAssetUrl(connection, remote.agentAvatarUrl)'));
  assert.ok(realtime.includes('resolveSupportAssetUrl(connection, item.agentAvatarUrl)'));
  assert.ok(ui.includes('conversation.agentAvatarUrl || conversation.productCoverUrl'));
  assert.ok(css.includes('.conversation-avatar,\n.chat-header-avatar'));
  assert.ok(css.includes('border-radius: 50%'));
  assert.ok(css.includes('object-fit: cover'));
});
