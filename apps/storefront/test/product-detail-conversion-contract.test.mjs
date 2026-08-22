import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('product detail keeps a conversion-first mobile hierarchy', async () => {
  const [
    source,
    rootSource,
    routeActionSource,
    viewportRuntime,
    shellStyles,
    styles,
    flowStyles,
    loadingStyles,
  ] = await Promise.all([
    readFile(new URL('../src/ProductDetailPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/StorefrontRouteAction.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-viewport-runtime.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-content-flow.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/loading-states.css', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /const address = product\.address\?\.trim\(\) \?\? '';/u);
  assert.match(
    source,
    /const bodyIsAddress = Boolean\(address && body && body === address\);/u,
  );
  assert.match(source, /className="product-detail-address"/u);
  assert.match(source, /className="detail-mobile-media-track"/u);
  assert.match(source, /className="detail-mobile-media-count"/u);
  assert.doesNotMatch(source, /product-detail-secondary-media/u);
  assert.doesNotMatch(source, /detail-mobile-thumbnails/u);

  assert.match(source, /StorefrontRouteAction/u);
  assert.match(source, /className="product-detail-route-action"/u);
  assert.doesNotMatch(source, /createPortal/u);
  assert.doesNotMatch(source, /document\.body/u);
  assert.doesNotMatch(source, /product-detail-navigation/u);
  assert.doesNotMatch(source, /product-detail-brand/u);

  assert.match(rootSource, /className="storefront-bottom-chrome"/u);
  assert.match(rootSource, /className="storefront-route-action-host"/u);
  assert.match(rootSource, /data-shell-header=/u);
  assert.match(rootSource, /storefront-detail-topbar/u);
  assert.match(rootSource, /observeStorefrontShellChrome/u);
  assert.match(routeActionSource, /StorefrontRouteActionHostContext/u);
  assert.match(routeActionSource, /createPortal/u);
  assert.match(viewportRuntime, /--app-bottom-chrome-height/u);
  assert.doesNotMatch(viewportRuntime, /--app-route-action-height/u);

  assert.match(source, /const ctaFailed =/u);
  assert.match(source, /enabled: Boolean\(product\?\.id\)/u);
  assert.match(source, /staleTime: Number\.POSITIVE_INFINITY/u);
  assert.match(source, /disabled=\{ctaLoading \|\| ctaMissing\}/u);
  assert.match(source, /className="product-detail-cta-label"/u);
  assert.doesNotMatch(source, /SYSTEM_UI\.continue/u);
  assert.match(source, /<span>\{SYSTEM_UI\.retry\}<\/span>/u);

  assert.match(shellStyles, /\.storefront-bottom-chrome \{[\s\S]*position: fixed/u);
  assert.match(
    shellStyles,
    /\.storefront-bottom-chrome \{[\s\S]*bottom: var\(--app-viewport-bottom/u,
  );
  assert.doesNotMatch(
    shellStyles,
    /\.storefront-route-action-host \{[\s\S]{0,220}position: fixed/u,
  );
  assert.match(shellStyles, /var\(--app-bottom-chrome-height/u);
  assert.doesNotMatch(shellStyles, /var\(--app-route-action-height/u);
  assert.doesNotMatch(
    shellStyles,
    /max\(var\(--theme-detail-cta-height[\s\S]{0,180}\+ 58px/u,
  );
  assert.doesNotMatch(
    shellStyles,
    /html\[data-storefront-presentation='push'\]\s+\.app-shell > \.topbar/u,
  );

  assert.match(styles, /\.product-detail-address \{/u);
  assert.match(
    styles,
    /\.product-detail-summary h1,[\s\S]*\.product-detail-address span/u,
  );
  assert.match(
    styles,
    /\.product-detail-route-action \{[\s\S]*--theme-detail-cta-surface/u,
  );
  assert.match(styles, /box-shadow: var\(\s*--theme-detail-cta-bar-shadow/u);
  assert.doesNotMatch(
    styles,
    /\.product-detail-route-action \{[\s\S]{0,240}position: fixed/u,
  );
  assert.match(
    styles,
    /\.product-detail-route-action \.cta-button,[\s\S]*min-height: max\([\s\S]*--theme-detail-cta-height[\s\S]*56px/u,
  );
  assert.match(
    styles,
    /\.product-detail-route-action \.cta-button,[\s\S]*font-weight: var\(--storefront-weight-semibold, 650\)/u,
  );
  assert.match(styles, /\.product-detail-route-action \.cta-button:focus-visible/u);
  assert.match(
    styles,
    /\.product-detail-route-action \.cta-button:active:not\(:disabled\)[\s\S]*var\(--theme-press-scale/u,
  );
  assert.match(
    styles,
    /\.product-detail-info \{[\s\S]*position: sticky;[\s\S]*top: [^;]+;/u,
  );
  assert.doesNotMatch(styles, /\.detail-mobile-gallery \{/u);
  assert.doesNotMatch(styles, /detail-mobile-media-track/u);
  assert.doesNotMatch(styles, /detail-mobile-media-count/u);

  assert.match(flowStyles, /\.detail-mobile-gallery \{/u);
  assert.match(flowStyles, /\.detail-mobile-media-track \{/u);
  assert.match(flowStyles, /scroll-snap-type: x mandatory/u);
  assert.match(
    flowStyles,
    /\.detail-mobile-media-item \{[\s\S]*scroll-snap-align: start/u,
  );
  assert.match(flowStyles, /\.detail-mobile-media-item > img/u);
  assert.match(flowStyles, /\.detail-mobile-media-count \{/u);
  assert.match(flowStyles, /\.detail-mobile-media-count::after \{/u);
  assert.match(flowStyles, /@media \(min-width: 768px\)/u);
  assert.doesNotMatch(flowStyles, /product-detail-secondary-media/u);

  assert.match(loadingStyles, /\.product-detail-loading-route-action \{/u);
  assert.doesNotMatch(
    loadingStyles,
    /\.product-detail-loading-route-action \{[\s\S]{0,240}position: fixed/u,
  );
  assert.doesNotMatch(loadingStyles, /product-detail-loading-navigation/u);
});
