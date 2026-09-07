import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseSupportProductContext } from '../src/support-product-context.ts';

const snapshot = {
  productId: 'product-1',
  title: 'Snapshot Product',
  coverUrl: 'https://example.com/product.webp',
  href: 'https://example.com/products/product-1',
  sectionId: 'section-1',
  sectionName: 'Section',
  categoryId: 'category-1',
  categoryName: 'Category',
};

test('product context parser preserves the complete customer-service snapshot', () => {
  assert.deepEqual(parseSupportProductContext(snapshot), snapshot);
  assert.equal(parseSupportProductContext({ ...snapshot, title: null }), null);
  assert.equal(parseSupportProductContext({ ...snapshot, categoryName: 7 }), null);
});

test('history and realtime share product-context validation before presentation', () => {
  const gateway = readFileSync(new URL('../src/support-gateway.ts', import.meta.url), 'utf8');
  const realtime = readFileSync(new URL('../src/support-realtime.ts', import.meta.url), 'utf8');

  assert.match(gateway, /parseSupportProductContext\(item\.productContext\)/u);
  assert.match(realtime, /parseSupportProductContext\(item\.productContext\)/u);
});
