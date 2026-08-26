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

  assert.match(storefrontMain, /@site\/storefront-ui\/layout-contract\.css/u);
  assert.match(adminManifest, /@site\/storefront-ui\/layout-contract\.css/u);
});
