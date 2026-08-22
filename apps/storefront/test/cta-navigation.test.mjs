import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

test('customer service CTA records the handoff then enters Messages through SPA navigation', () => {
  const productDetail = source('../src/ProductDetailPage.tsx');
  const cta = source('../src/cta.ts');
  const navigation = source('../src/storefront-navigation-runtime.ts');
  const workerConversion = source('../../worker/src/routes/public-conversion.ts');

  assert.match(productDetail, /resolveCustomerServiceCta\(cta\.path\)/u);
  assert.match(productDetail, /pushStorefrontLocation\(path\)/u);
  assert.match(productDetail, /\['support-compose-product', composeSectionId, composeProductId\]/u);
  assert.match(productDetail, /window\.location\.assign\(cta\.path\)/u);

  assert.match(cta, /headers: \{ Accept: 'application\/json' \}/u);
  assert.match(cta, /value\.path\.startsWith\('\/messages\/new\/'\)/u);
  assert.match(navigation, /window\.history\.pushState\(null, '',/u);
  assert.match(navigation, /target\.pathname === '\/messages\/'/u);
  assert.match(navigation, /navigateStorefrontBack\(\)/u);

  assert.match(workerConversion, /context\.req\.header\('accept'\)/u);
  assert.match(workerConversion, /return context\.json\(\{ path \}\)/u);
  assert.match(workerConversion, /return context\.redirect\(path, 302\)/u);
});
