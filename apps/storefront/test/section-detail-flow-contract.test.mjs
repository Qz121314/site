import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sectionSource = await readFile(
  new URL('../src/SectionPage.tsx', import.meta.url),
  'utf8',
);
const sectionCss = await readFile(
  new URL('../src/section-ui.css', import.meta.url),
  'utf8',
);
const detailSource = await readFile(
  new URL('../src/ProductDetailPage.tsx', import.meta.url),
  'utf8',
);
const ctaSource = await readFile(new URL('../src/cta.ts', import.meta.url), 'utf8');
const detailCss = await readFile(
  new URL('../src/product-detail-ui.css', import.meta.url),
  'utf8',
);

test('section catalog keeps compact app navigation and minimal product cards', () => {
  assert.match(sectionSource, /<header className="section-catalog-header">/);
  assert.match(
    sectionSource,
    /<h1 id="section-catalog-title">\{query\.data\.section\.name\}<\/h1>/,
  );
  assert.match(sectionSource, /className="section-catalog-back"/);
  assert.match(sectionSource, /<span className="sr-only">\{SYSTEM_UI\.back\}<\/span>/);
  assert.match(sectionSource, /className="section-product-card"/);
  assert.match(sectionSource, /className="section-product-cover"/);
  assert.doesNotMatch(sectionSource, /StorefrontProductCard/);
  assert.doesNotMatch(sectionSource, /categoryName=|address=|sectionName=|tags=/);
  assert.match(sectionCss, /\.section-catalog-header \{[\s\S]*position: sticky/);
  assert.match(sectionCss, /\.section-catalog-back \{[\s\S]*border-radius: 50%/);
  assert.match(sectionCss, /\.section-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1/);
});

test('section catalog uses category select plus horizontal tag filters', () => {
  assert.match(sectionSource, /className=\{`section-category-select/);
  assert.match(sectionSource, /<select/);
  assert.match(sectionSource, /value=\{categoryId\}/);
  assert.match(sectionSource, /<option value="">\{SYSTEM_UI\.all\}<\/option>/);
  assert.match(sectionSource, /className="section-tag-filter"/);
  assert.doesNotMatch(sectionSource, /className="section-category-options"/);
  assert.match(
    sectionCss,
    /\.section-category-select\s*\{[\s\S]*border-radius:\s*var\(--theme-radius-chip,/,
  );
  assert.match(sectionCss, /\.section-catalog-filters\s*\{[\s\S]*overflow-x: auto/);
});

test('product detail keeps Back at the left and routes the backend CTA by mode', () => {
  assert.match(detailSource, /loadPublicCta\(product!\.id, signal\)/);
  assert.match(detailSource, /href=\{cta\.path\}/);
  assert.match(detailSource, /cta\.mode === 'customer_service'/);
  assert.match(detailSource, /<LinkComponent/);
  assert.match(detailSource, /target="_blank"/);
  assert.match(detailSource, /rel="noopener noreferrer nofollow"/);
  assert.match(detailSource, /SYSTEM_UI\.temporarilyUnavailable/);
  assert.doesNotMatch(detailSource, /handleResolveCta|ctaDestination/);
  assert.doesNotMatch(detailSource, /method: 'POST'/);
  assert.doesNotMatch(detailSource, /\/cta\/[^\s]*\/resolve/);
  assert.match(ctaSource, /method: 'GET'/);
  assert.match(ctaSource, /value\.path\.startsWith\('\/'\)/);
  assert.match(detailCss, /\.product-detail-fixed-action \{[\s\S]*position: fixed/);
  assert.match(
    detailCss,
    /\.product-detail-navigation \{[\s\S]*position: fixed;[\s\S]*left:/,
  );
});
