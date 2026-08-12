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

test('section catalog uses direct category buttons and tag filtering', () => {
  assert.match(sectionSource, /type="search"/u);
  assert.match(sectionSource, /className="section-catalog-filters"/u);
  assert.match(sectionSource, /className="section-category-filter"/u);
  assert.match(
    sectionSource,
    /onClick=\{\(\) => setCategoryId\(''\)\}[\s\S]*?\{SYSTEM_UI\.all\}/u,
  );
  assert.match(sectionSource, /onClick=\{\(\) => setCategoryId\(category\.id\)\}/u);
  assert.match(sectionSource, /aria-pressed=\{isActive\}/u);
  assert.doesNotMatch(sectionSource, /<select|<option|section-category-select/u);
  assert.match(sectionSource, /className="section-tag-filter"/u);
  assert.match(sectionSource, /aria-pressed=\{selectedTags\.has\(tag\.id\)\}/u);
  assert.match(sectionSource, /\[\.\.\.selectedTags\]\.every/u);
  assert.match(sectionSource, /clearFilters/u);
  assert.match(sectionSource, /className="section-catalog-content"/u);
  assert.doesNotMatch(sectionSource, /section-catalog-results/u);
});

test('section product cards show product names without category labels', () => {
  assert.match(
    sectionSource,
    /<span className="section-product-meta">[\s\S]*?<h2>\{product\.title\}<\/h2>/u,
  );
  assert.doesNotMatch(
    sectionSource,
    /section-product-meta[\s\S]*?<small>|product\.category\.name \|\| product\.tags\[0\]/u,
  );
});

test('section header stays content-focused', () => {
  assert.match(
    sectionSource,
    /<h1 id="section-catalog-title">\{query\.data\.section\.name\}<\/h1>/u,
  );
  assert.match(sectionSource, /className="section-catalog-back"/u);
  assert.doesNotMatch(sectionSource, /SectionIcon|section-icon/u);
});

test('section products stay two-column', () => {
  assert.match(sectionSource, /className="section-catalog-products"/u);
  assert.match(sectionSource, /className="section-product-card"/u);
  assert.match(sectionSource, /className="section-product-cover"/u);
  assert.match(
    cssSource,
    /\.section-catalog-products\s*\{[\s\S]*?width:\s*min\(760px,\s*100%\)/u,
  );
  assert.match(cssSource, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(cssSource, /@media \(min-width:\s*768px\)/u);
  assert.doesNotMatch(
    cssSource,
    /\.section-catalog-products\s*\{[\s\S]*?grid-template-columns:\s*1fr[;\n]/u,
  );
});

test('mobile section catalog locks the document and scrolls only its content pane', () => {
  assert.match(cssSource, /body:has\(\.section-catalog\)[\s\S]*?overflow:\s*hidden/su);
  assert.match(
    cssSource,
    /\.app-shell:has\(\.section-catalog\)\s*> main\s*\{[^}]*height:\s*calc\(100dvh - 68px - env\(safe-area-inset-bottom\)\)[^}]*overflow:\s*hidden/su,
  );
  assert.match(
    cssSource,
    /\.section-catalog-content\s*\{[^}]*flex:\s*1 1 auto[^}]*overflow-y:\s*auto/su,
  );
});

test('section catalog uses Theme Center semantic variables and isolated styles', () => {
  assert.match(mainSource, /\.\/section-ui\.css/u);
  assert.match(cssSource, /var\(--surface\)/u);
  assert.match(cssSource, /var\(--brand-strong\)/u);
  assert.match(cssSource, /var\(--line\)/u);
  assert.match(cssSource, /var\(--theme-radius-control/u);
});
