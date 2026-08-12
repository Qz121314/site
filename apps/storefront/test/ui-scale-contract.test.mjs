import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const themeContract = await readFile(
  new URL('../../../packages/storefront-ui/src/theme-contract.css', import.meta.url),
  'utf8',
);
const typographyContract = await readFile(
  new URL('../../../packages/storefront-ui/src/typography-contract.css', import.meta.url),
  'utf8',
);
const contentCss = await readFile(
  new URL('../src/content-ui.css', import.meta.url),
  'utf8',
);
const browseCss = await readFile(
  new URL('../src/browse-ui.css', import.meta.url),
  'utf8',
);
const sectionCss = await readFile(
  new URL('../src/section-ui.css', import.meta.url),
  'utf8',
);
const productDetailCss = await readFile(
  new URL('../src/product-detail-ui.css', import.meta.url),
  'utf8',
);

test('Storefront keeps a readable four-step UI type scale', () => {
  assert.match(typographyContract, /--storefront-text-caption:\s*0\.6875rem;/u);
  assert.match(typographyContract, /--storefront-text-small:\s*0\.8125rem;/u);
  assert.match(typographyContract, /--storefront-text-body:\s*0\.9375rem;/u);
  assert.match(typographyContract, /--storefront-text-label:\s*0\.9375rem;/u);
  assert.match(
    typographyContract,
    /\.service-mode-badge,[\s\S]*\.bottom-nav small[\s\S]*font-size:\s*var\(--storefront-text-caption\)/u,
  );
});

test('Storefront interaction timing uses one restrained app motion system', () => {
  assert.match(themeContract, /--app-motion-fast:\s*140ms;/u);
  assert.match(themeContract, /--app-motion-base:\s*220ms;/u);
  assert.match(themeContract, /--app-motion-slow:\s*420ms;/u);
  assert.match(themeContract, /--app-ease-out:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\);/u);
});

test('all Theme Center densities keep touch controls at least 44px tall', () => {
  assert.match(themeContract, /--theme-control-height:\s*44px;/u);
  assert.match(
    themeContract,
    /\[data-density='compact'\][\s\S]*?--theme-control-height:\s*44px;/u,
  );
  assert.match(
    themeContract,
    /\[data-density='comfortable'\][\s\S]*?--theme-control-height:\s*48px;/u,
  );
  assert.doesNotMatch(themeContract, /--theme-control-height:\s*(?:[0-3]\d|4[0-3])px;/u);
});

test('product structure consumes theme tokens instead of being rewritten by the final theme layer', () => {
  assert.match(contentCss, /gap:\s*var\(--theme-card-gap-y/u);
  assert.match(contentCss, /grid-template-columns:\s*var\(--theme-desktop-media-size,/u);
  assert.match(contentCss, /min-height:\s*var\(--theme-desktop-media-size,/u);
  assert.match(contentCss, /border-radius:\s*var\(--theme-radius-media,/u);
  assert.doesNotMatch(themeContract, /html \.product-card\s*\{/u);
  assert.doesNotMatch(themeContract, /html \.product-card-media\s*\{/u);
  assert.doesNotMatch(themeContract, /html \.product-grid\s*\{/u);
});

test('Browse Section and Product detail consume the shared app scale', () => {
  assert.match(browseCss, /font-size:\s*var\(--storefront-text-body,/u);
  assert.match(browseCss, /font-size:\s*var\(--storefront-text-caption,/u);
  assert.match(sectionCss, /min-height:\s*[^;]*var\(--theme-control-height,/u);
  assert.match(sectionCss, /font-size:\s*var\(--storefront-text-small,/u);
  assert.match(productDetailCss, /font-size:\s*var\(--storefront-text-body,/u);
  assert.match(productDetailCss, /font-size:\s*var\(--storefront-text-caption,/u);
});
