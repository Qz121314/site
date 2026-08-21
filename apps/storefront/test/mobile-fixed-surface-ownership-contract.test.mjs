import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile persistent surfaces share one App Shell bottom chrome owner', () => {
  const main = source('../src/main.tsx');
  const root = source('../src/StorefrontRoot.tsx');
  const routeAction = source('../src/StorefrontRouteAction.tsx');
  const viewportRuntime = source('../src/storefront-viewport-runtime.ts');
  const appShell = source('../src/app-shell.css');
  const section = source('../src/section-ui.css');
  const detail = source('../src/product-detail-ui.css');
  const productPage = source('../src/ProductDetailPage.tsx');
  const messages = source('../src/messages-ui.css');
  const conversation = source('../src/chat-conversation.css');
  const removedLayer = new URL('../src/mobile-fixed-surfaces.css', import.meta.url);

  assert.equal(existsSync(removedLayer), false);
  assert.doesNotMatch(main, /mobile-fixed-surfaces\.css/u);
  assert.match(main, /installStorefrontViewportRuntime\(\)/u);

  assert.match(viewportRuntime, /window\.visualViewport/u);
  assert.match(viewportRuntime, /ResizeObserver/u);
  assert.match(viewportRuntime, /--app-header-height/u);
  assert.match(viewportRuntime, /--app-bottom-chrome-height/u);
  assert.doesNotMatch(viewportRuntime, /--app-bottom-nav-height/u);
  assert.doesNotMatch(viewportRuntime, /--app-route-action-height/u);

  assert.match(root, /className="storefront-bottom-chrome"/u);
  assert.match(root, /className="storefront-route-action-host"/u);
  assert.match(root, /data-shell-route=/u);
  assert.match(root, /observeStorefrontShellChrome/u);
  assert.match(routeAction, /createPortal\(children, host\)/u);

  assert.match(
    appShell,
    /\.app-shell > \.topbar \{[\s\S]*position: fixed;[\s\S]*--app-viewport-top/u,
  );
  assert.match(
    appShell,
    /\.storefront-bottom-chrome \{[\s\S]*position: fixed;[\s\S]*--app-viewport-bottom/u,
  );
  assert.doesNotMatch(
    appShell,
    /\.storefront-route-action-host \{[\s\S]{0,220}position: fixed/u,
  );
  assert.match(appShell, /var\(--app-bottom-chrome-height/u);
  assert.doesNotMatch(appShell, /var\(--app-bottom-nav-height/u);
  assert.doesNotMatch(appShell, /var\(--app-route-action-height/u);
  assert.match(appShell, /messages-workspace\.is-thread-open/u);

  assert.match(section, /var\(--app-viewport-height/u);
  assert.match(section, /var\(--app-bottom-chrome-height/u);
  assert.doesNotMatch(section, /var\(--app-bottom-nav-height/u);
  assert.doesNotMatch(section, /100dvh - 68px/u);
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
