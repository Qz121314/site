import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('conversion surfaces consume Theme Center material tokens without changing layout ownership', async () => {
  const [artDirection, artAdapters, primaryPages, home, catalog, detail, chrome] =
    await Promise.all([
      readFile(
        new URL(
          '../../../packages/storefront-ui/src/art-direction-contract.css',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../../../packages/storefront-ui/src/art-direction-primary-surfaces.css',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../../../packages/storefront-ui/src/primary-pages-theme-contract.css',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL('../../../packages/storefront-ui/src/home.css', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/catalog-polish.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/product-detail-ui.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/app-chrome.css', import.meta.url), 'utf8'),
    ]);

  for (const token of [
    '--theme-art-hero-copy-shadow',
    '--theme-art-hero-cta-background',
    '--theme-art-hero-cta-border',
    '--theme-art-hero-cta-color',
    '--theme-art-hero-cta-shadow',
    '--theme-art-media-press-shadow',
  ]) {
    assert.match(artDirection, new RegExp(`${token}:`, 'u'));
  }

  for (const themeKey of ['velvet', 'midnight', 'pearl']) {
    assert.match(
      artDirection,
      new RegExp(
        `\\[data-theme='${themeKey}'\\] \\{[\\s\\S]*?--theme-art-hero-cta-background:`,
        'u',
      ),
    );
  }

  assert.match(home, /text-shadow: var\(--theme-art-hero-copy-shadow\)/u);
  assert.match(home, /background: var\(--theme-art-hero-cta-background\)/u);
  assert.match(home, /border: 1px solid var\(--theme-art-hero-cta-border\)/u);
  assert.match(catalog, /box-shadow: var\(--theme-art-media-press-shadow\)/u);
  assert.match(catalog, /border-color: var\(--theme-art-media-frame\)/u);
  assert.match(artAdapters, /\.detail-mobile-media-item > img/u);

  for (const token of [
    '--theme-primary-header-background',
    '--theme-primary-header-backdrop',
    '--theme-primary-navigation-background',
    '--theme-primary-navigation-border',
    '--theme-primary-navigation-backdrop',
    '--theme-primary-navigation-active-surface',
    '--theme-primary-detail-cta-bar-background',
    '--theme-primary-detail-cta-border',
    '--theme-primary-detail-cta-shadow',
    '--theme-primary-detail-cta-focus-ring',
    '--theme-primary-detail-cta-arrow-background',
  ]) {
    assert.match(primaryPages, new RegExp(`${token}:`, 'u'));
  }

  assert.match(chrome, /background: var\(--theme-primary-header-background\)/u);
  assert.match(chrome, /backdrop-filter: var\(--theme-primary-header-backdrop\)/u);
  assert.match(
    chrome,
    /--theme-navigation-material[\s\S]*var\(--theme-primary-navigation-background\)/u,
  );
  assert.match(
    chrome,
    /--theme-navigation-backdrop[\s\S]*var\(--theme-primary-navigation-backdrop\)/u,
  );
  assert.match(chrome, /border-top-color: var\(--theme-primary-navigation-border\)/u);
  assert.match(detail, /background: var\(--theme-primary-detail-cta-bar-background\)/u);
  assert.match(detail, /border: 1px solid var\(--theme-primary-detail-cta-border\)/u);
  assert.match(detail, /box-shadow: var\(--theme-primary-detail-cta-shadow\)/u);
  assert.match(
    detail,
    /box-shadow:\s*var\(--theme-primary-detail-cta-shadow\),\s*var\(--theme-primary-detail-cta-focus-ring\)/u,
  );
  assert.match(detail, /background: var\(--theme-primary-detail-cta-arrow-background\)/u);
});
