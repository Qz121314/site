import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('customer-service catalog sync carries Site canonical product URLs', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/customer-service/api.ts', import.meta.url)),
    'utf8',
  );

  assert.ok(source.includes('function publicProductHref('));
  assert.ok(source.includes('window.location.origin'));
  assert.ok(source.includes('href: publicProductHref(section.slug, product.slug)'));
  assert.ok(source.includes("sourceType: 'product' as const"));
  assert.ok(source.includes('presentationMode: product.presentationMode'));
  assert.ok(source.includes('h5PageId: product.h5PageId'));
  assert.equal(source.includes('href: null'), false);
});
