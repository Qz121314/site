import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront resolves the assigned agent avatar without impersonating it with product media', () => {
  const contract = source('../src/support-contract.ts');
  const gateway = source('../src/support-gateway.ts');
  const realtime = source('../src/support-realtime.ts');
  const ui = source('../src/support-ui.tsx');
  const css = source('../src/messages-ui.css');

  assert.ok(contract.includes('agentAvatarUrl: string | null'));
  assert.ok(gateway.includes('resolveSupportAssetUrl'));
  assert.ok(
    gateway.includes(
      'agentAvatarUrl: resolveSupportAssetUrl(connection, remote.agentAvatarUrl)',
    ),
  );
  assert.ok(realtime.includes('resolveSupportAssetUrl(connection, item.agentAvatarUrl)'));
  assert.ok(ui.includes('if (conversation.agentAvatarUrl)'));
  assert.ok(ui.includes('src={conversation.agentAvatarUrl}'));
  assert.equal(
    ui.includes('conversation.agentAvatarUrl || conversation.productCoverUrl'),
    false,
  );
  assert.equal(
    ui.includes('className="chat-header-avatar"') &&
      ui.includes('src={productContext.productCoverUrl}'),
    false,
  );
  assert.ok(css.includes('.conversation-avatar,\n.chat-header-avatar'));
  assert.ok(css.includes('border-radius: 50%'));
  assert.ok(css.includes('object-fit: cover'));
});
