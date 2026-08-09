import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listRemoteSupportConversations,
  startRemoteSupportConversation,
} from '../src/messages/customer-service-messages.ts';

function connection() {
  return {
    id: 'connection-1',
    name: 'Support A',
    provider: 'generic_v1',
    baseUrl: 'https://support.example/api/v1',
    projectId: 'project-1',
    apiToken: 'secret-token',
    isEnabled: true,
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    deletedAt: null,
    targetCount: 1,
  };
}

async function withFetch(mock, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = original;
  }
}

const summary = {
  id: 'conversation-1',
  agentName: null,
  agentAvatarUrl: null,
  productId: 'product-1',
  sectionId: 'section-1',
  productTitle: 'Product One',
  productCoverUrl: null,
  lastMessage: 'Hello',
  lastMessageAt: '2026-08-09T12:00:00.000Z',
  unreadCount: 1,
  status: 'active',
};

const detail = {
  ...summary,
  createdAt: '2026-08-09T11:00:00.000Z',
  expiresAt: '2026-09-09T11:00:00.000Z',
  messages: [
    {
      id: 'message-1',
      direction: 'customer',
      body: 'Hello',
      sentAt: '2026-08-09T11:00:00.000Z',
      delivery: 'sent',
    },
  ],
  nextMessageCursor: null,
};

test('messages list sends visitor identity only from the Site Worker', async () => {
  let request;
  const result = await withFetch(
    async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ conversations: [summary] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    () => listRemoteSupportConversations(connection(), 'visitor-1', 'request-1'),
  );

  assert.equal(request.url, 'https://support.example/api/v1/messages/v1/conversations');
  const headers = new Headers(request.init.headers);
  assert.equal(headers.get('x-site-visitor-id'), 'visitor-1');
  assert.equal(headers.get('x-site-request-id'), 'request-1');
  assert.equal(headers.get('authorization'), 'Bearer secret-token');
  assert.equal(headers.get('x-project-id'), 'project-1');
  assert.equal(result[0].id, 'conversation-1');
});

test('conversation creation sends group, product context and idempotency key', async () => {
  let request;
  const result = await withFetch(
    async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ conversation: detail }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    () => startRemoteSupportConversation(connection(), 'visitor-1', 'request-1', {
      remoteGroupId: 'sales',
      clientMessageId: 'client-message-1',
      message: 'Hello',
      product: {
        id: 'product-1',
        sectionId: 'section-1',
        title: 'Product One',
        href: '/sections/section-1/products/product-1/',
        coverUrl: null,
      },
    }),
  );

  assert.equal(request.url, 'https://support.example/api/v1/messages/v1/conversations');
  assert.equal(request.init.method, 'POST');
  const headers = new Headers(request.init.headers);
  assert.equal(headers.get('idempotency-key'), 'client-message-1');
  const body = JSON.parse(request.init.body);
  assert.equal(body.remoteGroupId, 'sales');
  assert.equal(body.product.id, 'product-1');
  assert.equal(result.messages[0].body, 'Hello');
});
