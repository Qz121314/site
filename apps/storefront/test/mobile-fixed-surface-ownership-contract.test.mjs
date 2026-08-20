import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile fixed surfaces are owned by their route styles instead of a global override layer', () => {
  const main = source('../src/main.tsx');
  const appShell = source('../src/app-shell.css');
  const section = source('../src/section-ui.css');
  const detail = source('../src/product-detail-ui.css');
  const messages = source('../src/messages-ui.css');
  const conversation = source('../src/chat-conversation.css');
  const removedLayer = new URL('../src/mobile-fixed-surfaces.css', import.meta.url);

  assert.equal(existsSync(removedLayer), false);
  assert.doesNotMatch(main, /mobile-fixed-surfaces\.css/u);

  assert.match(appShell, /\.app-shell > \.bottom-nav/u);
  assert.match(appShell, /env\(safe-area-inset-bottom\)/u);
  assert.match(appShell, /messages-workspace\.is-thread-open/u);

  assert.match(section, /100dvh - 68px - env\(safe-area-inset-bottom\)/u);
  assert.match(section, /\.section-catalog-content[\s\S]*overflow-y: auto/u);

  assert.match(detail, /\.product-detail-fixed-action \{[\s\S]*position: fixed/u);
  assert.match(detail, /safe-area-inset-bottom/u);
  assert.match(detail, /\.product-detail-navigation/u);

  assert.match(messages, /\.messages-workspace\.is-thread-open/u);
  assert.match(messages, /\.chat-page/u);
  assert.match(conversation, /\.chat-composer[\s\S]*safe-area-inset-bottom/u);
});
