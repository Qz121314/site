import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sharedUiUrl = new URL(
  '../../../packages/storefront-ui/src/index.tsx',
  import.meta.url,
);
const storefrontRootUrl = new URL('../src/StorefrontRoot.tsx', import.meta.url);
const layoutUrl = new URL(
  '../../../packages/storefront-ui/src/layout-contract.css',
  import.meta.url,
);
const storefrontMainUrl = new URL('../src/main.tsx', import.meta.url);
const adminManifestUrl = new URL('../../admin/src/admin.css', import.meta.url);

test('branding is backend-driven and theme layout is invariant', async () => {
  const sharedUi = await readFile(sharedUiUrl, 'utf8');
  const storefrontRoot = await readFile(storefrontRootUrl, 'utf8');
  const layout = await readFile(layoutUrl, 'utf8');
  const storefrontMain = await readFile(storefrontMainUrl, 'utf8');
  const adminManifest = await readFile(adminManifestUrl, 'utf8');

  assert.doesNotMatch(sharedUi, /EROSDOOR/u);
  assert.match(sharedUi, /splitStorefrontBrandName/u);
  assert.match(sharedUi, /siteName\.trim\(\)/u);
  assert.match(storefrontRoot, /siteName=\{site\.name\}/u);

  assert.match(layout, /--theme-section-space: 24px !important;/u);
  assert.match(layout, /--theme-card-gap-y: 18px !important;/u);
  assert.match(layout, /--theme-card-gap-x: 10px !important;/u);
  assert.match(layout, /--theme-control-height: 44px !important;/u);
  assert.match(layout, /--theme-button-height: 52px !important;/u);
  assert.match(layout, /--theme-detail-gap: 18px !important;/u);
  assert.match(layout, /--theme-detail-panel-padding: 18px !important;/u);
  assert.match(layout, /--theme-detail-cta-height: 54px !important;/u);

  assert.match(
    layout,
    /\.home-product-meta \{[\s\S]*position: absolute;[\s\S]*bottom: 10px;/u,
  );
  assert.match(
    layout,
    /\.home-product-title \{[\s\S]*color: var\(--theme-art-on-media-primary/u,
  );
  assert.match(layout, /\.home-product-cover::before \{[\s\S]*opacity: 1;/u);
  assert.match(layout, /\.hero-carousel-copy \{[\s\S]*text-align: left;/u);
  assert.match(layout, /\.hero-panel \{[\s\S]*text-align: left !important;/u);

  assert.match(layout, /\.browse-search-product-title/u);
  assert.match(layout, /\.section-product-title/u);
  assert.match(layout, /\.product-card-heading h3/u);
  assert.match(layout, /overflow-wrap: anywhere !important;/u);
  assert.match(layout, /white-space: normal !important;/u);
  assert.match(layout, /-webkit-line-clamp: unset !important;/u);

  const storefrontThemeIndex = storefrontMain.indexOf(
    '@site/storefront-ui/theme-contract.css',
  );
  const storefrontLayoutIndex = storefrontMain.indexOf(
    '@site/storefront-ui/layout-contract.css',
  );
  const adminThemeIndex = adminManifest.indexOf('@site/storefront-ui/theme-contract.css');
  const adminLayoutIndex = adminManifest.indexOf(
    '@site/storefront-ui/layout-contract.css',
  );

  assert.ok(
    storefrontThemeIndex >= 0 && storefrontLayoutIndex > storefrontThemeIndex,
  );
  assert.ok(adminThemeIndex >= 0 && adminLayoutIndex > adminThemeIndex);
});
