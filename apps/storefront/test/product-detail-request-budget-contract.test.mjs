import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('legacy product routes resolve through one cached search index instead of all sections', () => {
  const root = source('../src/StorefrontRoot.tsx');
  const legacy = source('../src/LegacyProductRoute.tsx');
  const search = source('../src/search-index.ts');
  const content = source('../src/content.ts');

  assert.ok(root.includes("import('./LegacyProductRoute')"));
  assert.ok(root.includes('page = route.sectionRef ?'));
  assert.ok(legacy.includes("['storefront-browse-product-search'"));
  assert.ok(legacy.includes('loadBrowseSearchProducts(bootstrap, signal)'));
  assert.ok(legacy.includes('replaceStorefrontLocation(productHref(product))'));
  assert.ok(search.includes("cache: 'force-cache'"));
  assert.equal(
    content.includes(
      'bootstrap.home.allSections.map((item) =>\n        loadSectionSnapshot(bootstrap, item.id, signal)',
    ),
    false,
  );
  assert.ok(content.includes('Section context is required for published service details.'));
});

test('canonical product detail reuses remembered summary as immediate placeholder data', () => {
  const detail = source('../src/ProductDetailPage.tsx');

  assert.ok(detail.includes('sectionRef: string;'));
  assert.ok(detail.includes('Object.values(bootstrap.productSummaries)'));
  assert.ok(detail.includes('placeholderProductSnapshot'));
  assert.ok(detail.includes('placeholderData: knownProduct'));
  assert.ok(detail.includes("body: ''"));
  assert.ok(detail.includes('media: []'));
});
