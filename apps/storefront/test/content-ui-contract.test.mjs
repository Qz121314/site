import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const contentCss = await readFile(new URL('../src/content-ui.css', import.meta.url), 'utf8');
const storefrontPagesCss = await readFile(
  new URL('../src/storefront-pages.css', import.meta.url),
  'utf8',
);
const themeRuntimeCss = await readFile(
  new URL('../src/theme-runtime.css', import.meta.url),
  'utf8',
);
const themeContractCss = await readFile(
  new URL('../../../packages/storefront-ui/src/theme-contract.css', import.meta.url),
  'utf8',
);
const typographyContractCss = await readFile(
  new URL('../../../packages/storefront-ui/src/typography-contract.css', import.meta.url),
  'utf8',
);

test('content UI refinement loads after the app shell layer', () => {
  const shellImport = mainSource.indexOf("import './app-shell.css';");
  const contentImport = mainSource.indexOf("import './content-ui.css';");
  assert.ok(shellImport >= 0, 'app shell styles must be loaded');
  assert.ok(contentImport > shellImport, 'content UI must load after app shell styles');
});

test('product browsing stays two-column on mobile and desktop', () => {
  assert.match(
    contentCss,
    /@media \(max-width: 767px\)[\s\S]*?\.product-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/u,
  );
  assert.match(
    contentCss,
    /@media \(min-width: 768px\)[\s\S]*?\.product-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/u,
  );
});

test('mobile product cards use square cover-first marketplace layout', () => {
  assert.match(contentCss, /\.product-card-media\s*\{[\s\S]*?aspect-ratio:\s*1 \/ 1;/u);
  assert.match(contentCss, /\.product-card\s*\{[\s\S]*?background:\s*transparent;/u);
  assert.match(contentCss, /\.product-card-body\s*\{[\s\S]*?padding:\s*9px 2px 0;/u);
});

test('retired Discover, FAQ, section-directory, and filter selectors stay removed', () => {
  const cssLayers = [
    contentCss,
    storefrontPagesCss,
    themeRuntimeCss,
    themeContractCss,
    typographyContractCss,
  ];
  const retiredSelectors = [
    'content-section',
    'section-heading',
    'section-grid',
    'section-item',
    'section-icon',
    'discover-page',
    'discover-search',
    'discover-section-block',
    'discover-section-title',
    'discover-section-grid',
    'discover-results-empty',
    'filter-panel',
    'search-field',
    'select-field',
    'tag-filter',
    'result-toolbar',
    'faq-page',
    'faq-section',
  ];

  for (const css of cssLayers) {
    for (const selector of retiredSelectors) {
      assert.doesNotMatch(
        css,
        new RegExp(`\\.${selector}(?=[\\s,{:.#>+~])`, 'u'),
        `${selector} must not return to retired Storefront style layers`,
      );
    }
    assert.doesNotMatch(css, /\.faq-list\s+details/u);
  }
  assert.doesNotMatch(
    themeContractCss,
    /--theme-(?:control-shadow|filter-background|chip-background)\s*:/u,
  );
});
