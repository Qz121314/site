import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const [contract, compression, mediaGateway, page, ui] = await Promise.all([
  readFile(new URL('../src/support-contract.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/support-image-compress.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/support-media-gateway.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/MessagesPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/support-ui.tsx', import.meta.url), 'utf8'),
]);

test('support messages expose image attachments and image sending', () => {
  assert.match(contract, /SupportImageAttachment/u);
  assert.match(contract, /attachments: SupportImageAttachment\[\]/u);
  assert.match(contract, /sendImage\(/u);
});

test('visitor images are compressed aggressively before upload', () => {
  assert.match(compression, /MAX_EDGE = 1600/u);
  assert.match(compression, /TARGET_BYTES = 400 \* 1024/u);
  assert.match(compression, /MAX_STATIC_BYTES = 1024 \* 1024/u);
  assert.match(compression, /image\/webp/u);
});

test('visitor image flow initializes uploads and completes them', () => {
  assert.match(mediaGateway, /\/media\/init/u);
  assert.match(mediaGateway, /uploadSupportImage/u);
  assert.match(mediaGateway, /\/complete/u);
});

test('existing conversations expose image picker, progress and image bubbles', () => {
  assert.match(page, /imageProgress/u);
  assert.match(page, /onSendImage/u);
  assert.match(ui, /chat-attachment-picker/u);
  assert.match(ui, /chat-message-image/u);
  assert.match(ui, /image\/jpeg,image\/png,image\/webp,image\/gif/u);
});
