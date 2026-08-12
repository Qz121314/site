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
  assert.match(
    sectionSource,
    /<span className="section-catalog-back-label">\{SYSTEM_UI\.back\}<\/span>/,
  );
  assert.match(sectionSource, /className="section-product-card"/);
  assert.match(sectionSource, /className="section-product-cover"/);
  assert.match(sectionSource, /className="section-product-meta"/);
  assert.match(sectionSource, /product\.category\.name \|\| product\.tags\[0\]\?\.name/u);
  assert.doesNotMatch(sectionSource, /StorefrontProductCard/);
  assert.doesNotMatch(sectionSource, /categoryName=|address=|sectionName=|tags=/);
  assert.match(sectionCss, /\.section-catalog-header \{[\s\S]*position: relative/);
  assert.match(sectionCss, /\.section-catalog-back \{[\s\S]*display: inline-flex/);
  assert.match(sectionCss, /\.section-catalog-back \{[\s\S]*min-width: 44px/);
  assert.match(sectionCss, /\.section-catalog-back \{[\s\S]*height: 44px/);
  assert.match(sectionCss, /\.section-catalog-back \{[\s\S]*border: 0/);
  assert.match(sectionCss, /\.section-catalog-back \{[\s\S]*border-radius: 0/);
  assert.match(sectionCss, /\.section-catalog-back \{[\s\S]*background: transparent/);
  assert.match(sectionCss, /\.section-catalog-back-label \{[\s\S]*white-space: nowrap/);
  assert.match(sectionCss, /\.section-catalog-content \{[\s\S]*min-height: 0/);
  assert.match(sectionCss, /\.section-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1/);
  assert.match(sectionCss, /\.section-product-meta \{[\s\S]*gap: 3px/);
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

test('product detail resolves CTA only on click and routes by mode', () => {
  assert.match(detailSource, /enabled:\s*false/);
  assert.match(detailSource, /loadPublicCta\(product!\.id, signal\)/);
  assert.match(detailSource, /ctaQuery\.refetch\(\)/);
  assert.match(detailSource, /cta\.mode === 'customer_service'/);
  assert.match(detailSource, /navigateInternalCta\(cta\.path\)/);
  assert.match(detailSource, /window\.location\.assign\(cta\.path\)/);
  assert.match(detailSource, /new Event\('storefront:navigate'\)/);
  assert.match(detailSource, /SYSTEM_UI\.temporarilyUnavailable/);
  assert.doesNotMatch(detailSource, /handleResolveCta|ctaDestination/);
  assert.doesNotMatch(detailSource, /method: 'POST'/);
  assert.doesNotMatch(detailSource, /\/cta\/[^\s]*\/resolve/);
  assert.match(ctaSource, /method: 'GET'/);
  assert.match(ctaSource, /value\.path\.startsWith\('\/'\)/);
  assert.match(detailCss, /\.product-detail-fixed-action \{[\s\S]*position: fixed/);
  assert.match(
    detailCss,
    /\.product-detail-navigation \{[\s\S]*position: sticky;[\s\S]*top: 0/,
  );
});
