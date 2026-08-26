import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test(
  'site branding stays backend-driven and theme layouts stay structurally invariant',
  async () => {
    const [sharedUi, storefrontRoot, layout, storefrontMain, adminManifest] =
      await Promise.all([
        readFile(
          new URL('../../../packages/storefront-ui/src/index.tsx', import.meta.url),
          'utf8',
        ),
        readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
        readFile(
          new URL('../../../packages/storefront-ui/src/layout-contract.css', import.meta.url),
          'utf8',
        ),
        readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../../admin/src/admin.css', import.meta.url), 'utf8'),
      ]);

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
  },
);
