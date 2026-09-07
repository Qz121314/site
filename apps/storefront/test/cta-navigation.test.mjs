import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('CTA navigation keeps customer service in-app and link handoffs in a new tab', () => {
  const productDetail = source('../src/ProductDetailPage.tsx');
  const messagesPage = source('../src/MessagesPage.tsx');
  const cta = source('../src/cta.ts');
  const navigation = source('../src/storefront-navigation-runtime.ts');
  const workerConversion = source('../../worker/src/routes/public-conversion.ts');

  assert.match(productDetail, /ctaPath: cta\.path/u);
  assert.match(productDetail, /pushStorefrontLocation\(/u);
  assert.match(productDetail, /\/messages\/new\/\?/u);
  assert.match(productDetail, /window\.open\(cta\.path, '_blank', 'noopener'\)/u);
  assert.doesNotMatch(productDetail, /window\.location\.assign\(cta\.path\)/u);

  assert.match(messagesPage, /resolveCustomerServiceCta\(/u);
  assert.match(messagesPage, /composeContext\.ctaPath/u);
  assert.match(messagesPage, /replaceStorefrontLocation\(/u);

  assert.match(cta, /Accept: 'application\/json'/u);
  assert.match(cta, /value\.path\.startsWith\('\/messages\/new\/'\)/u);
  assert.match(navigation, /window\.history\.pushState/u);
  assert.match(workerConversion, /context\.req\.header\('accept'\)/u);
  assert.match(workerConversion, /return context\.json\(\{ path \}\)/u);
  assert.match(workerConversion, /return context\.redirect\(path, 302\)/u);
});
