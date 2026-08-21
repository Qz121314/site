import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile persistent surfaces are owned by App Shell instead of route patches', () => {
  const main = source('../src/main.tsx');
  const root = source('../src/StorefrontRoot.tsx');
  const routeAction = source('../src/StorefrontRouteAction.tsx');
  const appShell = source('../src/app-shell.css');
  const section = source('../src/section-ui.css');
  const detail = source('../src/product-detail-ui.css');
  const productPage = source('../src/ProductDetailPage.tsx');
  const messages = source('../src/messages-ui.css');
  const conversation = source('../src/chat-conversation.css');
  const removedLayer = new URL('../src/mobile-fixed-surfaces.css', import.meta.url);

  assert.equal(existsSync(removedLayer), false);
  assert.doesNotMatch(main, /mobile-fixed-surfaces\.css/u);

  assert.match(appShell, /\.app-shell > \.bottom-nav/u);
  assert.match(appShell, /\.storefront-route-action-host \{[\s\S]*position: fixed/u);
  assert.match(appShell, /env\(safe-area-inset-bottom\)/u);
  assert.match(appShell, /messages-workspace\.is-thread-open/u);
  assert.match(root, /className="storefront-route-action-host"/u);
  assert.match(root, /data-shell-route=/u);
  assert.match(routeAction, /createPortal\(children, host\)/u);

  assert.match(section, /100dvh - 68px - env\(safe-area-inset-bottom\)/u);
  assert.match(section, /\.section-catalog-content[\s\S]*overflow-y: auto/u);

  assert.match(detail, /\.product-detail-route-action \{/u);
  assert.match(detail, /safe-area-inset-bottom/u);
  assert.doesNotMatch(
    detail,
    /\.product-detail-route-action \{[\s\S]{0,240}position: fixed/u,
  );
  assert.doesNotMatch(detail, /\.product-detail-navigation/u);
  assert.doesNotMatch(productPage, /createPortal|document\.body/u);
  assert.match(productPage, /StorefrontRouteAction/u);

  assert.match(messages, /\.messages-workspace\.is-thread-open/u);
  assert.match(messages, /\.chat-page/u);
  assert.match(conversation, /\.chat-composer[\s\S]*safe-area-inset-bottom/u);
});
