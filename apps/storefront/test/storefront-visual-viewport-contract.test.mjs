import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Storefront App Shell owns live VisualViewport and measured fixed-chrome geometry', async () => {
  const [main, runtime, root, productDetail, indexHtml] = await Promise.all([
    read('../src/main.tsx'),
    read('../src/storefront-viewport-runtime.ts'),
    read('../src/StorefrontRoot.tsx'),
    read('../src/ProductDetailPage.tsx'),
    read('../index.html'),
  ]);

  assert.match(main, /installStorefrontViewportRuntime\(\)/u);
  assert.match(runtime, /window\.visualViewport/u);
  assert.match(runtime, /addEventListener\('resize'/u);
  assert.match(runtime, /addEventListener\('scroll'/u);
  assert.match(runtime, /focusin/u);
  assert.match(runtime, /focusout/u);
  assert.match(runtime, /ResizeObserver/u);
  assert.match(runtime, /--app-viewport-height/u);
  assert.match(runtime, /--app-viewport-top/u);
  assert.match(runtime, /--app-viewport-bottom/u);
  assert.match(runtime, /--app-bottom-chrome-inset/u);
  assert.match(runtime, /--app-header-height/u);
  assert.match(runtime, /--app-bottom-chrome-height/u);
  assert.doesNotMatch(runtime, /--app-bottom-nav-height/u);
  assert.doesNotMatch(runtime, /--app-route-action-height/u);

  assert.match(root, /observeStorefrontShellChrome/u);
  assert.match(root, /className="storefront-bottom-chrome"/u);
  assert.match(root, /className="storefront-route-action-host"/u);

  assert.match(productDetail, /StorefrontRouteAction/u);
  assert.doesNotMatch(productDetail, /createPortal|document\.body/u);

  assert.match(indexHtml, /viewport-fit=cover/u);
  assert.match(indexHtml, /interactive-widget=resizes-content/u);
});
