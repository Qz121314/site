import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeSupportLinkValue,
  normalizeSupportPhoneValue,
} from '../src/support-attachment-safety.ts';
import { loadConversationMedia } from '../src/support-media-gateway.ts';

test('support attachment safety only accepts normalized phones and http(s) links', () => {
  assert.equal(normalizeSupportPhoneValue('+12135551234'), '+12135551234');
  assert.equal(normalizeSupportPhoneValue('2135551234'), '2135551234');
  assert.equal(normalizeSupportPhoneValue('+1 213 555 1234'), null);
  assert.equal(normalizeSupportPhoneValue('javascript:alert(1)'), null);

  assert.equal(
    normalizeSupportLinkValue('https://example.com/pay?id=123'),
    'https://example.com/pay?id=123',
  );
  assert.equal(normalizeSupportLinkValue('http://example.com'), 'http://example.com/');
  assert.equal(normalizeSupportLinkValue('javascript:alert(1)'), null);
  assert.equal(normalizeSupportLinkValue('data:text/html,hello'), null);
  assert.equal(normalizeSupportLinkValue('file:///tmp/test'), null);
  assert.equal(normalizeSupportLinkValue('/relative/path'), null);
});

test('conversation attachment history parses phone, link, legacy image, and snapshot image safely', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        items: [
          {
            messageId: 'message-1',
            id: 'phone-1',
            kind: 'phone',
            label: '短信联系',
            value: '+12135551234',
          },
          {
            messageId: 'message-1',
            id: 'link-1',
            kind: 'link',
            label: '付款链接',
            value: 'https://example.com/pay',
          },
          {
            messageId: 'message-1',
            id: 'unsafe-link',
            kind: 'link',
            label: '危险链接',
            value: 'javascript:alert(1)',
          },
          {
            messageId: 'message-2',
            id: 'legacy-image',
            kind: 'image',
            label: 'legacy.png',
            mimeType: 'image/png',
            byteSize: 128,
            width: 320,
            height: 180,
            originalName: 'legacy.png',
            source: 'media',
          },
          {
            messageId: 'message-3',
            id: 'greeting-image',
            kind: 'image',
            label: '问候图片',
            mimeType: 'image/webp',
            byteSize: 256,
            width: 640,
            height: 360,
            originalName: 'greeting.webp',
            source: 'snapshot',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  };

  try {
    const media = await loadConversationMedia(
      { clientApiUrl: 'https://support.example/client/v1' },
      'conversation-1',
    );

    assert.match(
      requestedUrl,
      /^https:\/\/support\.example\/client\/v1\/conversations\/conversation-1\/media\?/u,
    );
    assert.match(requestedUrl, /visitorId=/u);

    const firstMessage = media.get('message-1') ?? [];
    assert.deepEqual(
      firstMessage.map((attachment) => [
        attachment.kind,
        attachment.label,
        'value' in attachment ? attachment.value : null,
      ]),
      [
        ['phone', '短信联系', '+12135551234'],
        ['link', '付款链接', 'https://example.com/pay'],
      ],
    );

    const legacyImage = media.get('message-2')?.[0];
    assert.equal(legacyImage?.kind, 'image');
    if (legacyImage?.kind === 'image') {
      assert.match(legacyImage.url, /\/client\/v1\/media\/legacy-image\/content\?/u);
    }

    const greetingImage = media.get('message-3')?.[0];
    assert.equal(greetingImage?.kind, 'image');
    if (greetingImage?.kind === 'image') {
      assert.match(
        greetingImage.url,
        /\/client\/v1\/attachments\/greeting-image\/content\?/u,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
