import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/ProductDetailPage.tsx', import.meta.url),
  'utf8',
);
const flowCss = readFileSync(
  new URL('../src/product-detail-content-flow.css', import.meta.url),
  'utf8',
);
const uiCss = readFileSync(
  new URL('../src/product-detail-ui.css', import.meta.url),
  'utf8',
);

test('mobile product gallery is compact and clearly communicates swipe navigation', () => {
  assert.match(source, /className="detail-mobile-media-track"/u);
  assert.match(source, /className="detail-mobile-media-count"/u);
  assert.match(flowCss, /\.detail-mobile-gallery \{[\s\S]*width: 100%;/u);
  assert.match(flowCss, /\.detail-mobile-gallery \{[\s\S]*margin-inline: 0;/u);
  assert.match(flowCss, /\.detail-mobile-gallery \{[\s\S]*border-radius:/u);
  assert.match(
    flowCss,
    /\.detail-mobile-media-count \{[\s\S]*top: 12px;[\s\S]*min-width: 50px;[\s\S]*font-weight: 760;/u,
  );
  assert.match(flowCss, /\.detail-mobile-media-count::after \{[\s\S]*content: '↔';/u);
});

test('product CTA displays the live backend label and keeps it visually centered', () => {
  assert.match(source, /enabled: Boolean\(product\?\.id\)/u);
  assert.match(source, /staleTime: Number\.POSITIVE_INFINITY/u);
  assert.match(
    source,
    /<span className="product-detail-cta-label">\{cta\.label\}<\/span>/u,
  );
  assert.doesNotMatch(source, /SYSTEM_UI\.continue/u);
  assert.match(
    source,
    /const cta = ctaQuery\.data \?\? \(await ctaQuery\.refetch\(\)\)\.data;/u,
  );
  assert.match(
    uiCss,
    /\.product-detail-route-action \.cta-button\.is-ready,[\s\S]*justify-content: center;/u,
  );
  assert.match(
    uiCss,
    /\.product-detail-cta-arrow \{[\s\S]*position: absolute;[\s\S]*right: 10px;/u,
  );
});
