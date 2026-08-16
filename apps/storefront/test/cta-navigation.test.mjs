import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const productDetailSource = readFileSync(
  fileURLToPath(new URL('../src/ProductDetailPage.tsx', import.meta.url)),
  'utf8',
);

test('customer service CTA crosses the Worker /go route with a document navigation', () => {
  assert.match(
    productDetailSource,
    /function navigateInternalCta\(path: string\) \{\s*window\.location\.assign\(path\);\s*\}/u,
  );
  assert.doesNotMatch(
    productDetailSource,
    /window\.history\.pushState\(null, '', path\)/u,
  );
});
