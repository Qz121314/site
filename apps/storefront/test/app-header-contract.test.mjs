import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootSource = await readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8');
const headerSource = await readFile(new URL('../src/StorefrontAppHeader.tsx', import.meta.url), 'utf8');
const shellCss = await readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8');
const browseSource = await readFile(new URL('../src/BrowsePage.tsx', import.meta.url), 'utf8');
const sectionSource = await readFile(new URL('../src/SectionPage.tsx', import.meta.url), 'utf8');

test('Home is the only primary shell route that uses the centered site brand', () => {
  assert.match(rootSource, /header=\{\{ kind: 'home' \}\}/u);
  assert.match(headerSource, /config\.kind === 'home'/u);
  assert.match(headerSource, /storefront-home-brand/u);
  assert.match(shellCss, /\.storefront-app-header\.is-home\s*\{[^}]*justify-content:\s*center/su);
});

test('primary pages use backend-driven centered page titles instead of the site brand', () => {
  assert.match(rootSource, /title:\s*copy\.browse\.title/u);
  assert.match(rootSource, /title:\s*copy\.messages\.title/u);
  assert.match(rootSource, /title:\s*copy\.faq\.title/u);
  assert.match(headerSource, /storefront-app-header-title/u);
  assert.match(shellCss, /grid-template-columns:\s*minmax\(40px,\s*1fr\)\s+minmax\(0,\s*auto\)\s+minmax\(40px,\s*1fr\)/u);
});

test('nested catalog routes keep Back inside the compact app header', () => {
  assert.match(rootSource, /title:\s*sectionTitle/u);
  assert.match(rootSource, /title:\s*product\?\.title \?\? copy\.product\.loading/u);
  assert.match(rootSource, /backHref:\s*'\/browse\/'/u);
  assert.match(rootSource, /backHref:\s*productBackHref/u);
  assert.match(headerSource, /className="storefront-app-header-back"/u);
  assert.match(headerSource, /aria-label=\{pageConfig\.backLabel\}/u);
  assert.match(headerSource, /canNavigateStorefrontBack/u);
  assert.match(headerSource, /navigateStorefrontBack/u);
  assert.doesNotMatch(headerSource, /<small>/u);
  assert.match(shellCss, /min-height:\s*calc\(48px \+ env\(safe-area-inset-top\)\)/u);
  assert.match(shellCss, /\.storefront-app-header-back\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px/su);
});

test('Browse and Section content do not duplicate page-level titles under the app header', () => {
  assert.doesNotMatch(browseSource, /browse-directory-heading/u);
  assert.doesNotMatch(sectionSource, /section-catalog-header|section-catalog-title/u);
});
