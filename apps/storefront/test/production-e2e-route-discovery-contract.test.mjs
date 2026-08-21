import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production product E2E discovers published routes from public data and targets Shell-owned CTA chrome', async () => {
  const [helper, ctaSpec, smokeSpec, desktopSpec] = await Promise.all([
    readFile(
      new URL('../../../tests/e2e/published-storefront-fixtures.ts', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL(
        '../../../tests/e2e/customer-service-cta-navigation.spec.ts',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(
      new URL('../../../tests/e2e/production-smoke.spec.ts', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../../../tests/e2e/desktop-production.spec.ts', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(helper, /api\/public\/storefront\/bootstrap/u);
  assert.match(helper, /findPublishedSectionRoute/u);
  assert.match(helper, /findPublishedProductRoute/u);
  assert.match(helper, /sectionsIndex/u);
  assert.match(helper, /featuredProducts/u);
  assert.match(helper, /latestProducts/u);

  for (const source of [ctaSpec, smokeSpec, desktopSpec]) {
    assert.match(source, /findPublishedProductRoute/u);
    assert.doesNotMatch(source, /\.getAttribute\('href'\)/u);
  }

  assert.match(smokeSpec, /findPublishedSectionRoute/u);
  assert.match(
    ctaSpec,
    /\.storefront-route-action-host \.product-detail-route-action \.cta-button/u,
  );
  assert.doesNotMatch(ctaSpec, /\.product-detail-fixed-action/u);
});
