import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('official dating themes own distinct art direction and shared media chrome', async () => {
  const [
    artDirection,
    themeContract,
    primaryPages,
    productDetail,
    browse,
    catalog,
    detailFlow,
    shared,
  ] = await Promise.all([
    readFile(
      new URL(
        '../../../packages/storefront-ui/src/art-direction-contract.css',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(
      new URL('../../../packages/storefront-ui/src/theme-contract.css', import.meta.url),
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
      new URL(
        '../../../packages/storefront-ui/src/product-detail-theme-contract.css',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(new URL('../src/browse-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/catalog-polish.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-content-flow.css', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../packages/storefront-ui/src/styles.css', import.meta.url),
      'utf8',
    ),
  ]);

  for (const themeKey of ['velvet', 'midnight', 'pearl']) {
    const recipe = new RegExp(
      `\\[data-theme='${themeKey}'\\] \\{[\\s\\S]*?--theme-art-heading-weight:[\\s\\S]*?--theme-art-media-filter:[\\s\\S]*?--theme-art-hero-overlay:[\\s\\S]*?--theme-art-product-overlay:`,
      'u',
    );
    assert.match(artDirection, recipe);
    assert.match(
      themeContract,
      new RegExp(
        `\\[data-theme='${themeKey}'\\] \\{[\\s\\S]*?--theme-card-background:[\\s\\S]*?--theme-media-background:`,
        'u',
      ),
    );
    assert.match(
      primaryPages,
      new RegExp(
        `\\[data-theme='${themeKey}'\\] \\{[\\s\\S]*?--theme-primary-message-background:`,
        'u',
      ),
    );
    assert.match(
      productDetail,
      new RegExp(
        `\\[data-theme='${themeKey}'\\] \\{[\\s\\S]*?--theme-detail-panel-background:`,
        'u',
      ),
    );
  }

  for (const token of [
    '--theme-art-media-canvas',
    '--theme-art-media-frame',
    '--theme-art-media-title-shadow',
    '--theme-art-media-control-background',
    '--theme-art-media-control-border',
    '--theme-art-media-control-shadow',
  ]) {
    assert.match(artDirection, new RegExp(`${token}:`, 'u'));
  }

  assert.match(browse, /background: var\(--theme-art-media-canvas\)/u);
  assert.match(browse, /border: 1px solid var\(--theme-art-media-frame\)/u);
  assert.match(catalog, /text-shadow: var\(--theme-art-media-title-shadow\)/u);
  assert.match(detailFlow, /background: var\(--theme-art-media-control-background\)/u);
  assert.match(detailFlow, /box-shadow: var\(--theme-art-media-control-shadow\)/u);

  assert.doesNotMatch(
    shared,
    /\[data-theme='velvet'\][\s\S]{0,180}\.product-card[\s\S]{0,120}box-shadow: 0 8px 24px/u,
  );
  assert.match(shared, /\.product-card \{[\s\S]*box-shadow: var\(--theme-card-shadow/u);
});
