import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('product detail keeps a conversion-first mobile hierarchy', async () => {
  const [source, styles, flowStyles, loadingStyles] = await Promise.all([
    readFile(new URL('../src/ProductDetailPage.tsx', import.meta.url), 'utf8'),
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

  assert.match(source, /const ctaFailed =/u);
  assert.match(source, /disabled=\{ctaQuery\.isFetching \|\| ctaMissing\}/u);
  assert.match(source, /<span>\{SYSTEM_UI\.retry\}<\/span>/u);

  assert.match(styles, /\.product-detail-navigation \{[\s\S]*position: absolute/u);
  assert.match(styles, /\.product-detail-address \{/u);
  assert.match(
    styles,
    /\.product-detail-summary h1,[\s\S]*\.product-detail-address span/u,
  );
  assert.match(styles, /\.product-detail-fixed-action \{[\s\S]*position: fixed/u);
  assert.match(styles, /\.product-detail-fixed-action \{[\s\S]*bottom: 0/u);
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
  assert.match(flowStyles, /\.detail-mobile-media-item \{[\s\S]*scroll-snap-align: start/u);
  assert.match(flowStyles, /\.detail-mobile-media-item > img/u);
  assert.match(flowStyles, /\.detail-mobile-media-count \{/u);
  assert.match(flowStyles, /@media \(min-width: 768px\)/u);
  assert.doesNotMatch(flowStyles, /product-detail-secondary-media/u);

  assert.match(
    loadingStyles,
    /\.product-detail-loading-navigation \{[\s\S]*position: absolute/u,
  );
});