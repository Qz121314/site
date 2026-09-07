import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront resolves the assigned agent avatar without substituting product media', () => {
  const contract = source('../src/support-contract.ts');
  const gateway = source('../src/support-gateway.ts');
  const realtime = source('../src/support-realtime.ts');
  const ui = source('../src/support-ui.tsx');

  assert.match(contract, /agentAvatarUrl: string \| null/u);
  assert.match(gateway, /resolveSupportAssetUrl/u);
  assert.match(
    gateway,
    /agentAvatarUrl: resolveSupportAssetUrl\(connection, remote\.agentAvatarUrl\)/u,
  );
  assert.match(realtime, /resolveSupportAssetUrl\(connection, item\.agentAvatarUrl\)/u);
  assert.match(ui, /conversation\.agentAvatarUrl/u);
  assert.doesNotMatch(
    ui,
    /conversation\.agentAvatarUrl \|\| conversation\.productCoverUrl/u,
  );
});
