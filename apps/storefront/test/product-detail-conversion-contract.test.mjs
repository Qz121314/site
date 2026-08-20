import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('product detail keeps a conversion-first mobile hierarchy', async () => {
  const [source, styles, flowStyles, shell] = await Promise.all([
    readFile(new URL('../src/ProductDetailPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-content-flow.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-shell.css', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /const address = product\.address\?\.trim\(\) \?\? '';/u);
  assert.match(
    source,
    /const bodyIsAddress = Boolean\(address && body && body === address\);/u,
  );
  assert.match(source, /className="product-detail-address"/u);
  assert.match(source, /className="product-detail-secondary-media"/u);
  assert.doesNotMatch(source, /detail-mobile-thumbnails/u);

  assert.match(source, /const ctaFailed =/u);
  assert.match(source, /disabled=\{ctaQuery\.isFetching \|\| ctaMissing\}/u);
  assert.match(source, /<span>\{SYSTEM_UI\.retry\}<\/span>/u);

  assert.match(styles, /\.product-detail-navigation \{[\s\S]*position: absolute/u);
  assert.match(styles, /\.product-detail-address \{/u);
  assert.match(styles, /\.product-detail-fixed-action \{[\s\S]*position: fixed/u);
  assert.match(styles, /\.product-detail-fixed-action \{[\s\S]*bottom: 0/u);
  assert.match(
    styles,
    /\.product-detail-info \{[\s\S]*position: sticky;[\s\S]*top: 86px/u,
  );

  assert.match(flowStyles, /\.product-detail-secondary-media \{/u);
  assert.match(flowStyles, /loading/u);
  assert.match(flowStyles, /@media \(min-width: 768px\)/u);
  assert.match(shell, /\.product-detail-loading-navigation \{[\s\S]*position: absolute/u);
});
