import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('CTA compose creates the remote conversation without inventing a visitor text message', () => {
  const messages = source('../src/MessagesPage.tsx');
  const core = source('../src/support-chat-core.ts');
  const contract = source('../src/support-contract.ts');
  const gateway = source('../src/support-gateway.ts');

  const sendMutation = core.indexOf('const sendMutation = useMutation');
  const startConversation = gateway.indexOf(
    'async startConversation(input: StartSupportConversationInput, signal)',
  );
  const sendMessage = gateway.indexOf('async sendMessage(conversationRef: string');

  assert.ok(sendMutation >= 0);
  assert.doesNotMatch(messages, /siteSupportGateway\.startConversation\(/u);
  assert.match(core, /siteSupportGateway\.startConversation\(startInput/u);
  assert.ok(startConversation >= 0);
  assert.ok(sendMessage > startConversation);
  assert.match(messages, /useSupportChatCore/u);
  assert.match(messages, /handoffId: resolvedComposeContext\.handoffId/u);
  assert.doesNotMatch(messages, /setComposeOptimisticMessage/u);
  assert.doesNotMatch(contract, /clientMessageId: string;\s*message: string;/u);

  const conversationCreation = gateway.slice(startConversation, sendMessage);
  assert.match(conversationCreation, /sourceHandoffId: input\.handoffId/u);
  assert.doesNotMatch(conversationCreation, /clientMessageId: input\.clientMessageId/u);
  assert.doesNotMatch(conversationCreation, /message: input\.message/u);
});

test('no-agent responses do not create a waiting conversation', () => {
  const gateway = source('../src/support-gateway.ts');

  assert.match(gateway, /readonly format: 'plain' \| 'markdown' \| null/u);
  assert.match(gateway, /conversation\.status === 'waiting'/u);
  assert.match(gateway, /'NO_AGENT_AVAILABLE'/u);
  assert.match(gateway, /conversation\.status !== 'waiting'/u);
});
