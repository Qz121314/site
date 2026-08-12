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
const cssSource = await readFile(
  new URL('../src/section-ui.css', import.meta.url),
  'utf8',
);
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('section route uses a dedicated primary-shell product catalog', () => {
  assert.match(rootSource, /case 'section':/u);
  assert.match(rootSource, /sectionRef=\{route\.sectionRef\}/u);
  assert.match(rootSource, /<PrimaryShell[\s\S]*activePath=\{pathname\}/u);
  assert.match(rootSource, /<SectionCatalogPage/u);
});

test('section catalog is search plus category select and touch-first tag filtering', () => {
  assert.match(sectionSource, /type="search"/u);
  assert.match(sectionSource, /className="section-catalog-filters"/u);
  assert.match(sectionSource, /section-category-select/u);
  assert.match(sectionSource, /<select/u);
  assert.match(sectionSource, /value=\{categoryId\}/u);
  assert.match(
    sectionSource,
    /onChange=\{\(event\) => setCategoryId\(event\.target\.value\)\}/u,
  );
  assert.match(
    sectionSource,
    /<option value="">\{SYSTEM_UI\.all\}<\/option>/u,
  );
  assert.doesNotMatch(sectionSource, /className="section-category-options"/u);
  assert.match(sectionSource, /className="section-tag-filter"/u);
  assert.match(
    sectionSource,
    /aria-pressed=\{selectedTags\.has\(tag\.id\)\}/u,
  );
  assert.match(sectionSource, /\[\.\.\.selectedTags\]\.every/u);
  assert.match(sectionSource, /clearFilters/u);
  assert.doesNotMatch(sectionSource, /section-catalog-results/u);
});

test('section header stays content-focused and does not reuse Home shortcut icons', () => {
  assert.match(
    sectionSource,
    /<h1 id="section-catalog-title">\{query\.data\.section\.name\}<\/h1>/u,
  );
  assert.match(sectionSource, /className="section-catalog-back"/u);
  assert.doesNotMatch(sectionSource, /SectionIcon|section-icon/u);
});

test('section products remain a two-column minimal product list on mobile and desktop', () => {
  assert.match(sectionSource, /className="section-catalog-products"/u);
  assert.match(sectionSource, /className="section-product-card"/u);
  assert.match(sectionSource, /className="section-product-cover"/u);
  assert.match(
    cssSource,
    /\.section-catalog-products\s*\{[\s\S]*?width:\s*min\(760px,\s*100%\)[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u,
  );
  assert.match(cssSource, /@media \(min-width:\s*768px\)/u);
  assert.doesNotMatch(
    cssSource,
    /\.section-catalog-products\s*\{[\s\S]*?grid-template-columns:\s*1fr[;\n]/u,
  );
});

test('section catalog uses Theme Center semantic variables and isolated styles', () => {
  assert.match(mainSource, /\.\/section-ui\.css/u);
  assert.match(cssSource, /var\(--surface\)/u);
  assert.match(cssSource, /var\(--brand-strong\)/u);
  assert.match(cssSource, /var\(--line\)/u);
  assert.match(cssSource, /var\(--theme-radius-control/u);
});
