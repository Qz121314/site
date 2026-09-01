import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSupportContactCardHref,
  normalizeSupportContactCardValue,
  normalizeSupportLinkValue,
  normalizeSupportPhoneValue,
  normalizeSupportPresetMessage,
  normalizeSupportTelegramValue,
} from '../src/support-attachment-safety.ts';
import { loadConversationMedia } from '../src/support-media-gateway.ts';

test('support attachment safety accepts canonical contact-card values only', () => {
  assert.equal(normalizeSupportPhoneValue('+12135551234'), '+12135551234');
  assert.equal(normalizeSupportPhoneValue('2135551234'), '2135551234');
  assert.equal(normalizeSupportPhoneValue('+1 (213) 555-1234'), '+12135551234');
  assert.equal(normalizeSupportPhoneValue('javascript:alert(1)'), null);

  assert.equal(normalizeSupportTelegramValue('@example_support'), 'example_support');
  assert.equal(normalizeSupportTelegramValue('example_support'), 'example_support');
  assert.equal(normalizeSupportTelegramValue('bad-name'), null);

  assert.equal(
    normalizeSupportLinkValue('https://example.com/pay?id=123'),
    'https://example.com/pay?id=123',
  );
  assert.equal(normalizeSupportLinkValue('http://example.com'), 'http://example.com/');
  assert.equal(normalizeSupportLinkValue('javascript:alert(1)'), null);
  assert.equal(normalizeSupportLinkValue('data:text/html,hello'), null);
  assert.equal(normalizeSupportLinkValue('file:///tmp/test'), null);
  assert.equal(normalizeSupportLinkValue('/relative/path'), null);

  assert.equal(normalizeSupportPresetMessage(' Hello '), 'Hello');
  assert.equal(normalizeSupportPresetMessage('   '), null);
  assert.equal(
    normalizeSupportContactCardValue('sms', '+1 213 555 1234'),
    '+12135551234',
  );
  assert.equal(
    normalizeSupportContactCardValue('website', 'https://example.com/help'),
    'https://example.com/help',
  );
});

test('contact-card hrefs open the intended channel and never dial SMS cards', () => {
  assert.equal(
    buildSupportContactCardHref('sms', '+12135551234', 'Need help'),
    'sms:+12135551234?body=Need%20help',
  );
  assert.equal(
    buildSupportContactCardHref('whatsapp', '+12135551234', 'Need help'),
    'https://wa.me/12135551234?text=Need%20help',
  );
  assert.equal(
    buildSupportContactCardHref('telegram', 'example_support', 'Need help'),
    'https://t.me/example_support?text=Need%20help',
  );
  assert.equal(
    buildSupportContactCardHref('website', 'https://example.com/help', null),
    'https://example.com/help',
  );
  assert.doesNotMatch(buildSupportContactCardHref('sms', '+12135551234', null), /^tel:/u);
});

test('conversation attachment history parses all canonical contact cards and images safely', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        items: [
          {
            messageId: 'message-1',
            id: 'sms-1',
            kind: 'sms',
            label: '短信联系',
            value: '+1 (213) 555-1234',
            presetMessage: 'Hello',
            hasCustomIcon: false,
          },
          {
            messageId: 'message-1',
            id: 'whatsapp-1',
            kind: 'whatsapp',
            label: 'WhatsApp',
            value: '+12135551234',
            presetMessage: 'WhatsApp hello',
            hasCustomIcon: false,
          },
          {
            messageId: 'message-1',
            id: 'telegram-1',
            kind: 'telegram',
            label: 'Telegram',
            value: '@example_support',
            presetMessage: 'Telegram hello',
            hasCustomIcon: false,
          },
          {
            messageId: 'message-1',
            id: 'website-1',
            kind: 'website',
            label: '帮助中心',
            value: 'https://example.com/help',
            presetMessage: null,
            hasCustomIcon: false,
          },
          {
            messageId: 'message-1',
            id: 'unsafe-website',
            kind: 'website',
            label: '危险链接',
            value: 'javascript:alert(1)',
          },
          {
            messageId: 'message-1',
            id: 'invalid-website-preset',
            kind: 'website',
            label: '错误网页名片',
            value: 'https://example.com',
            presetMessage: 'not allowed',
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
        'presetMessage' in attachment ? attachment.presetMessage : null,
      ]),
      [
        ['sms', '短信联系', '+12135551234', 'Hello'],
        ['whatsapp', 'WhatsApp', '+12135551234', 'WhatsApp hello'],
        ['telegram', 'Telegram', 'example_support', 'Telegram hello'],
        ['website', '帮助中心', 'https://example.com/help', null],
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
