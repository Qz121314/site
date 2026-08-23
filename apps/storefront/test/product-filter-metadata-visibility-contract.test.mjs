import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8');
const sharedHomeSource = readFileSync(
  new URL('../../../packages/storefront-ui/src/index.tsx', import.meta.url),
  'utf8',
);
const browseSource = readFileSync(
  new URL('../src/BrowsePage.tsx', import.meta.url),
  'utf8',
);
const sectionSource = readFileSync(
  new URL('../src/SectionPage.tsx', import.meta.url),
  'utf8',
);
const detailSource = readFileSync(
  new URL('../src/ProductDetailPage.tsx', import.meta.url),
  'utf8',
);

test('classification metadata remains filter-only across product presentation', () => {
  assert.match(homeSource, /StorefrontHomeProductTile/u);
  assert.match(sharedHomeSource, /home-product-title/u);
  assert.doesNotMatch(sharedHomeSource, /home-product-kicker|contextLabel/u);

  assert.match(browseSource, /browse-search-product-title/u);
  assert.match(browseSource, /product\.category\.name \?\? ''/u);
  assert.match(browseSource, /product\.tags\.map/u);
  assert.doesNotMatch(browseSource, /browse-search-product-kicker|contextLabel/u);

  assert.match(sectionSource, /section-product-title/u);
  assert.match(
    sectionSource,
    /if \(categoryId && product\.category\.id !== categoryId\) return false;/u,
  );
  assert.match(sectionSource, /product\.tags\.map/u);
  assert.doesNotMatch(sectionSource, /section-product-kicker|contextLabel/u);

  assert.doesNotMatch(
    detailSource,
    /product-detail-context|product-detail-tags|detailContext/u,
  );
});
