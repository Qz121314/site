import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('customer-service traffic handoff ID reaches the remote conversation request', () => {
  const messages = source('../src/MessagesPage.tsx');
  const contract = source('../src/support-contract.ts');
  const gateway = source('../src/support-gateway.ts');

  assert.ok(messages.includes("params.get('handoffId')"));
  assert.ok(messages.includes('handoffId: composeContext.handoffId'));
  assert.ok(contract.includes('handoffId: string'));
  assert.ok(gateway.includes('sourceHandoffId: input.handoffId'));
});
