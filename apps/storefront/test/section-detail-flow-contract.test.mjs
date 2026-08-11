import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sectionSource = await readFile(new URL('../src/SectionPage.tsx', import.meta.url), 'utf8');
const sectionCss = await readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8');
const detailSource = await readFile(
  new URL('../src/ProductDetailPage.tsx', import.meta.url),
  'utf8',
);
const detailCss = await readFile(
  new URL('../src/product-detail-ui.css', import.meta.url),
  'utf8',
);

test('section catalog keeps the section name in the app header and product cards minimal', () => {
  assert.match(sectionSource, /<header className="section-catalog-header">/);
  assert.match(sectionSource, /<h1 id="section-catalog-title">\{query\.data\.section\.name\}<\/h1>/);
  assert.match(sectionSource, /className="section-product-card"/);
  assert.match(sectionSource, /className="section-product-cover"/);
  assert.doesNotMatch(sectionSource, /StorefrontProductCard/);
  assert.doesNotMatch(sectionSource, /categoryName=|address=|sectionName=|tags=/);
  assert.match(sectionCss, /\.section-catalog-header \{[\s\S]*position: sticky/);
  assert.match(sectionCss, /\.section-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1/);
});

test('product CTA resolves on first click and only navigates after resolution', () => {
  assert.match(
    detailSource,
    /\/api\/public\/storefront\/cta\/\$\{encodeURIComponent\(productId\)\}\/resolve/,
  );
  assert.match(detailSource, /method: 'POST'/);
  assert.match(detailSource, /onClick=\{\(\) => void handleResolveCta\(\)\}/);
  assert.match(detailSource, /ctaDestination\.mode === 'customer_service'/);
  assert.match(detailSource, /target="_blank"/);
  assert.doesNotMatch(detailSource, /href=\{product\.cta\.path\}/);
  assert.match(detailCss, /\.product-detail-fixed-action \{[\s\S]*position: fixed/);
  assert.match(detailCss, /\.product-detail-navigation \{[\s\S]*justify-content: flex-end/);
});
