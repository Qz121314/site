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
  const sendMessage = gateway.indexOf('async sendMessage(conversationRef: string');

  assert.ok(startQuery >= 0);
  assert.ok(sendMutation > startQuery);
  assert.ok(startConversation >= 0);
  assert.ok(sendMessage > startConversation);
  assert.ok(messages.includes('return siteSupportGateway.startConversation('));
  assert.ok(messages.includes('handoffId: composeContext.handoffId'));
  assert.ok(messages.includes('enabled: !compose'));
  assert.ok(messages.includes('replaceStorefrontLocation('));
  assert.equal(messages.includes('window.history.replaceState('), false);
  assert.equal(messages.includes('setComposeOptimisticMessage'), false);
  assert.equal(contract.includes('clientMessageId: string;\n  message: string;'), false);

  // Regression guard: creating a conversation must not carry visitor content.
  const conversationCreation = gateway.slice(startConversation, sendMessage);
  assert.ok(conversationCreation.includes('sourceHandoffId: input.handoffId'));
  assert.equal(
    conversationCreation.includes('clientMessageId: input.clientMessageId'),
    false,
  );
  assert.equal(conversationCreation.includes('message: input.message'), false);
});

test('no-agent responses render configured plain text or Markdown without a waiting conversation', () => {
  const messages = source('../src/MessagesPage.tsx');
  const gateway = source('../src/support-gateway.ts');
  const supportUi = source('../src/support-ui.tsx');
  const chatStyles = source('../src/chat-conversation.css');
  const noAgentComponent = source('../../../packages/storefront-ui/src/no-agent.tsx');
  const noAgentStyles = source('../../../packages/storefront-ui/src/no-agent.css');

  assert.ok(messages.includes("composeStartQuery.error.code === 'NO_AGENT_AVAILABLE'"));
  assert.ok(messages.includes('noAgentNotice={noAgentNotice}'));
  assert.ok(gateway.includes("readonly format: 'plain' | 'markdown' | null"));
  assert.ok(gateway.includes("conversation.status === 'waiting'"));
  assert.ok(gateway.includes("'NO_AGENT_AVAILABLE'"));
  assert.ok(gateway.includes("conversation.status !== 'waiting'"));
  assert.ok(supportUi.includes('StorefrontNoAgentNotice'));
  assert.ok(supportUi.includes("noAgentNotice.format === 'markdown'"));
  assert.ok(supportUi.includes('<MarkdownContent source={noAgentNotice.message} />'));
  assert.ok(supportUi.includes('<p>{noAgentNotice.message}</p>'));
  assert.equal(chatStyles.includes('.chat-no-agent-notice {'), false);
  assert.ok(noAgentComponent.includes('StorefrontNoAgentNotice'));
  assert.ok(noAgentStyles.includes('.storefront-no-agent-notice {'));
  assert.ok(noAgentStyles.includes('text-align: center;'));
  assert.ok(noAgentStyles.includes('.storefront-no-agent-notice .markdown-content'));
});
