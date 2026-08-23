import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('primary surfaces consume one Theme Center elevation contract', async () => {
  const [theme, artDirection, catalog, browse, section, detail, detailFlow] =
    await Promise.all([
      readFile(
        new URL(
          '../../../packages/storefront-ui/src/primary-pages-theme-contract.css',
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
      readFile(new URL('../src/catalog-polish.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/browse-ui.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/product-detail-ui.css', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/product-detail-content-flow.css', import.meta.url),
        'utf8',
      ),
    ]);

  assert.match(theme, /--theme-primary-detail-panel-shadow:/u);
  assert.match(theme, /--theme-primary-detail-media-shadow:/u);
  assert.match(theme, /--theme-primary-detail-cta-bar-shadow:/u);

  assert.doesNotMatch(artDirection, /box-shadow:/u);
  assert.match(catalog, /box-shadow: var\(--theme-art-media-shadow/u);
  assert.match(catalog, /box-shadow: var\(--theme-art-media-hover-shadow/u);
  assert.match(catalog, /scale\(var\(--theme-art-media-press-scale/u);

  assert.doesNotMatch(browse, /\.browse-search-product-cover \{[^}]*box-shadow:/u);
  assert.doesNotMatch(section, /\.section-product-cover \{[^}]*box-shadow:/u);
  assert.match(
    browse,
    /\.browse-section-card \{[^}]*box-shadow: var\(--theme-art-media-shadow/u,
  );

  assert.match(detail, /--theme-primary-detail-media-shadow/u);
  assert.match(detail, /--theme-primary-detail-panel-shadow/u);
  assert.match(detail, /--theme-primary-detail-cta-bar-shadow/u);
  assert.match(detailFlow, /--theme-primary-detail-media-shadow/u);
});
