import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const chat = await readFile(
  new URL('../src/landing/LandingChatPage.tsx', import.meta.url),
  'utf8',
);
const core = await readFile(
  new URL('../src/support-chat-core.ts', import.meta.url),
  'utf8',
);

test('Landing Chat is routed outside the ordinary Storefront chrome', () => {
  assert.match(root, /route\.type === 'landing' \|\| route\.type === 'landing-chat'/u);
  assert.match(
    root,
    /enabled: route\.type !== 'landing' && route\.type !== 'landing-chat'/u,
  );
  assert.match(chat, /useSupportChatCore/u);
  assert.match(chat, /landing-chat/u);
});

test('Landing Chat core reuses the existing conversation, media and realtime boundaries', () => {
  assert.match(core, /siteSupportGateway\.startConversation/u);
  assert.match(core, /siteSupportGateway\.sendMessage/u);
  assert.match(core, /siteSupportGateway\.sendImage/u);
  assert.match(core, /markConversationRead/u);
  assert.match(core, /subscribeSupportRealtime/u);
  assert.match(core, /openSupportTypingChannel/u);
});
