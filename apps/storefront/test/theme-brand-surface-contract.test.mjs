import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('brand-colored controls share readable foreground and restrained elevation tokens', async () => {
  const [runtime, sharedStyles, theme, detailTheme, primaryTheme, storefrontStyles] =
    await Promise.all([
      read('../src/theme-runtime.ts'),
      read('../../../packages/storefront-ui/src/styles.css'),
      read('../../../packages/storefront-ui/src/theme-contract.css'),
      read('../../../packages/storefront-ui/src/product-detail-theme-contract.css'),
      read('../../../packages/storefront-ui/src/primary-pages-theme-contract.css'),
      read('../src/styles.css'),
    ]);

  assert.match(runtime, /storefrontBrandForeground/u);
  assert.match(runtime, /--theme-on-brand/u);
  assert.match(sharedStyles, /color: var\(--theme-on-brand, #000\)/u);
  assert.match(storefrontStyles, /color: var\(--theme-on-brand, #000\)/u);
  assert.match(primaryTheme, /--theme-primary-chat-send-color: var\(--theme-on-brand/u);
  assert.match(primaryTheme, /--theme-primary-detail-cta-color: var\(--theme-on-brand/u);
  assert.match(
    primaryTheme,
    /--theme-primary-install-action-color: var\(--theme-on-brand/u,
  );
  assert.match(primaryTheme, /color: var\(--theme-on-brand/u);
  assert.match(detailTheme, /--theme-detail-cta-color: var\(--theme-on-brand/u);
  assert.match(
    detailTheme,
    /--theme-detail-cta-shadow: var\(--theme-button-shadow, none\)/u,
  );
  assert.doesNotMatch(detailTheme, /--theme-detail-cta-shadow:\s*0 10px 28px/u);
  assert.match(theme, /--theme-on-brand: #000/u);
});
