import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sectionSource = await readFile(
  new URL('../src/SectionPage.tsx', import.meta.url),
  'utf8',
);
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const appHeaderSource = await readFile(
  new URL('../src/StorefrontAppHeader.tsx', import.meta.url),
  'utf8',
);
const cssSource = await readFile(
  new URL('../src/section-ui.css', import.meta.url),
  'utf8',
);
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('section route uses a dedicated primary-shell product catalog', () => {
  assert.match(rootSource, /function SectionRoot\(/u);
  assert.match(rootSource, /case 'section':/u);
  assert.match(rootSource, /<SectionRoot sectionRef=\{route\.sectionRef\} \/>/u);
  assert.match(rootSource, /<SectionCatalogPage/u);
});

test('section catalog is search plus category plus tag filtering', () => {
  assert.match(sectionSource, /type="search"/u);
  assert.match(sectionSource, /className="section-category-filter"/u);
  assert.match(sectionSource, /<select value=\{categoryId\}/u);
  assert.match(sectionSource, /className="section-tag-filter"/u);
  assert.match(sectionSource, /aria-pressed=\{selectedTags\.has\(tag\.id\)\}/u);
  assert.match(sectionSource, /\[\.\.\.selectedTags\]\.every/u);
  assert.match(sectionSource, /clearFilters/u);
});

test('section identity is owned by the route-aware app header without a duplicate page heading', () => {
  assert.match(rootSource, /const sectionTitle =/u);
  assert.match(rootSource, /title:\s*sectionTitle/u);
  assert.match(rootSource, /backHref:\s*'\/browse\/'/u);
  assert.match(rootSource, /backLabel:\s*copy\.section\.backLabel/u);
  assert.match(appHeaderSource, /storefront-app-header-title/u);
  assert.doesNotMatch(sectionSource, /section-catalog-header|section-catalog-title/u);
});

test('section products remain a two-column product list on mobile and desktop', () => {
  assert.match(sectionSource, /className="product-grid section-catalog-products"/u);
  assert.match(
    cssSource,
    /\.section-catalog-products\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u,
  );
  assert.match(
    cssSource,
    /@media \(max-width:\s*767px\)[\s\S]*\.section-catalog-products/u,
  );
});

test('section catalog uses Theme Center semantic variables and isolated styles', () => {
  assert.match(mainSource, /\.\/section-ui\.css/u);
  assert.match(cssSource, /var\(--surface\)/u);
  assert.match(cssSource, /var\(--brand-strong\)/u);
  assert.match(cssSource, /var\(--line\)/u);
  assert.match(cssSource, /var\(--theme-radius-control/u);
});
