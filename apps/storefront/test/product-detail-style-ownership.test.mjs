import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('product detail content stays separate from App Shell chrome ownership', () => {
  const shellUrl = new URL('../src/product-detail-shell.css', import.meta.url);
  const main = source('../src/main.tsx');
  const root = source('../src/StorefrontRoot.tsx');
  const routeAction = source('../src/StorefrontRouteAction.tsx');
  const loadingSurface = source('../src/ProductDetailLoadingSurface.tsx');
  const loadingCss = source('../src/loading-states.css');
  const appShellCss = source('../src/app-shell.css');
  const productDetailPage = source('../src/ProductDetailPage.tsx');
  const productDetailUi = source('../src/product-detail-ui.css');
  const contentFlowCss = source('../src/product-detail-content-flow.css');

  assert.equal(existsSync(shellUrl), false);
  assert.equal(main.includes("import './product-detail-shell.css';"), false);

  assert.ok(main.includes("import './loading-states.css';"));
  assert.ok(loadingCss.includes('.product-detail-loading {'));
  assert.ok(loadingCss.includes('.product-detail-loading-route-action {'));
  assert.ok(loadingCss.includes('.product-detail-loading-inline-action {'));
  assert.equal(loadingCss.includes('.product-detail-loading-navigation {'), false);

  assert.match(root, /data-shell-header=\{headerMode\}/u);
  assert.match(root, /data-shell-route=\{route\.type\}/u);
  assert.match(root, /className="topbar storefront-detail-topbar"/u);
  assert.match(root, /className="storefront-route-action-host"/u);
  assert.match(appShellCss, /\.storefront-route-action-host \{[\s\S]*position: fixed/u);
  assert.match(appShellCss, /\.storefront-detail-topbar \{/u);
  assert.doesNotMatch(appShellCss, /\.app-shell:has\(\.product-detail-page\)/u);
  assert.doesNotMatch(appShellCss, /\.app-shell:has\(\.product-detail-loading\)/u);
  assert.doesNotMatch(
    appShellCss,
    /data-storefront-presentation='push'[\s\S]{0,120}\.app-shell > \.topbar/u,
  );

  assert.match(routeAction, /StorefrontRouteActionHostContext/u);
  assert.match(routeAction, /createPortal\(children, host\)/u);
  assert.match(loadingSurface, /StorefrontRouteAction/u);
  assert.match(loadingSurface, /product-detail-loading-route-action/u);
  assert.match(root, /routeFallback = <ProductDetailLoadingSurface \/>/u);
  assert.match(root, /<Suspense fallback=\{routeFallback\}>/u);
  assert.match(productDetailPage, /return <ProductDetailLoadingSurface \/>/u);
  assert.doesNotMatch(productDetailPage, /function ProductDetailSkeleton/u);

  assert.match(productDetailPage, /StorefrontRouteAction/u);
  assert.doesNotMatch(productDetailPage, /createPortal|document\.body/u);
  assert.doesNotMatch(productDetailPage, /product-detail-navigation/u);

  assert.ok(productDetailPage.includes("import './product-detail-ui.css';"));
  assert.ok(productDetailPage.includes("import './product-detail-content-flow.css';"));
  assert.equal(main.includes("import './product-detail-ui.css';"), false);
  assert.equal(main.includes("import './product-detail-content-flow.css';"), false);

  assert.ok(contentFlowCss.includes('.detail-mobile-gallery {'));
  assert.ok(contentFlowCss.includes('.detail-mobile-media-track {'));
  assert.ok(contentFlowCss.includes('.detail-mobile-media-count {'));
  assert.equal(contentFlowCss.includes('.product-detail-secondary-media {'), false);
  assert.equal(productDetailUi.includes('.detail-mobile-gallery {'), false);
  assert.equal(productDetailUi.includes('detail-mobile-media-track'), false);
  assert.equal(productDetailUi.includes('detail-mobile-media-count'), false);
  assert.ok(productDetailUi.includes('.product-detail-route-action {'));
  assert.doesNotMatch(
    productDetailUi,
    /\.product-detail-route-action \{[\s\S]{0,240}position: fixed/u,
  );
});
