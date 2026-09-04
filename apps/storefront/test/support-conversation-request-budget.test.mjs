import assert from 'node:assert/strict';
import test from 'node:test';
import { siteSupportGateway } from '../src/support-gateway.ts';

test('conversation detail carries page attachments without a separate media request', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes('/api/public/storefront/support/connections')) {
      return new Response(
        JSON.stringify({
          connections: [
            {
              id: 'connection-1',
              clientApiUrl: 'https://support.example/client/v1',
              realtimeUrl: 'wss://support.example/client/v1/realtime',
              protocolVersion: 'v1',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    assert.match(url, /\/conversations\/conversation-1\?/u);
    assert.doesNotMatch(url, /\/media(?:\?|\/)/u);
    return new Response(
      JSON.stringify({
        conversation: {
          id: 'conversation-1',
          agentName: 'Agent',
          agentAvatarUrl: null,
          productId: 'product-1',
          sectionId: 'section-1',
          productTitle: 'Product',
          productCoverUrl: null,
          lastMessage: 'Hello',
          lastMessageAt: '2026-09-03T12:00:00.000Z',
          unreadCount: 0,
          status: 'active',
          productHref: 'https://example.com/product',
          createdAt: '2026-09-03T11:00:00.000Z',
          expiresAt: '2026-09-04T11:00:00.000Z',
          messages: [
            {
              id: 'message-product-1',
              direction: 'customer',
              body: 'Product',
              kind: 'product_context',
              productContext: {
                productId: 'product-1',
                title: 'Snapshot Product',
                coverUrl: 'https://example.com/snapshot.webp',
                href: 'https://example.com/snapshot-product',
                sectionId: 'section-1',
                sectionName: 'Section',
                categoryId: 'category-1',
                categoryName: 'Category',
              },
              sentAt: '2026-09-03T11:59:00.000Z',
              delivery: 'read',
              attachments: [],
            },
            {
              id: 'message-1',
              direction: 'agent',
              body: '',
              sentAt: '2026-09-03T12:00:00.000Z',
              delivery: 'sent',
              attachments: [
                {
                  id: 'image-1',
                  messageId: 'message-1',
                  kind: 'image',
                  label: 'image.png',
                  mimeType: 'image/png',
                  byteSize: 10,
                  width: 10,
                  height: 10,
                  originalName: 'image.png',
                  source: 'media',
                  url: 'https://account.r2.cloudflarestorage.com/media/image-1.png?X-Amz-Signature=x',
                },
                {
                  id: 'card-1',
                  messageId: 'message-1',
                  kind: 'sms',
                  label: 'SMS',
                  value: '+12135551234',
                  presetMessage: null,
                  hasCustomIcon: false,
                },
              ],
            },
          ],
          nextMessageCursor: 'cursor-1',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const detail = await siteSupportGateway.getConversation(
      'connection-1:conversation-1',
    );
    assert.equal(requested.length, 2);
    assert.equal(detail?.messages[0]?.kind, 'product_context');
    assert.deepEqual(detail?.messages[0]?.productContext, {
      productId: 'product-1',
      title: 'Snapshot Product',
      coverUrl: 'https://example.com/snapshot.webp',
      href: 'https://example.com/snapshot-product',
      sectionId: 'section-1',
      sectionName: 'Section',
      categoryId: 'category-1',
      categoryName: 'Category',
    });
    assert.equal(detail?.messages[1]?.attachments.length, 2);
    assert.equal(detail?.nextMessageCursor, 'cursor-1');
    assert.equal(detail?.messages[1]?.attachments[0]?.kind, 'image');
    assert.equal(detail?.messages[1]?.attachments[1]?.kind, 'sms');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
