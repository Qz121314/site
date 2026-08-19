import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('CTA compose creates the conversation before any visitor message', () => {
  const messages = source('../src/MessagesPage.tsx');
  const contract = source('../src/support-contract.ts');
  const gateway = source('../src/support-gateway.ts');

  const startQuery = messages.indexOf("queryKey: ['support-compose-start'");
  const sendMutation = messages.indexOf('const sendMutation = useMutation');
  const startConversation = gateway.indexOf(
    'async startConversation(input: StartSupportConversationInput, signal)',
  );
  const sendMessage = gateway.indexOf(
    'async sendMessage(conversationRef: string',
  );

  assert.ok(startQuery >= 0);
  assert.ok(sendMutation > startQuery);
  assert.ok(startConversation >= 0);
  assert.ok(sendMessage > startConversation);
  assert.ok(messages.includes('return siteSupportGateway.startConversation('));
  assert.ok(messages.includes('handoffId: composeContext.handoffId'));
  assert.ok(messages.includes('enabled: !compose'));
  assert.ok(messages.includes('window.history.replaceState('));
  assert.equal(messages.includes('setComposeOptimisticMessage'), false);
  assert.equal(contract.includes('clientMessageId: string;\n  message: string;'), false);

  const conversationCreation = gateway.slice(startConversation, sendMessage);
  assert.ok(conversationCreation.includes('sourceHandoffId: input.handoffId'));
  assert.equal(
    conversationCreation.includes('clientMessageId: input.clientMessageId'),
    false,
  );
  assert.equal(conversationCreation.includes('message: input.message'), false);
});
