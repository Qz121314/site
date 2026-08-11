import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/routes/public-storefront-config.ts', import.meta.url),
  'utf8',
);

test('public CTA resolver separates destination selection from navigation', () => {
  assert.match(source, /post\('\/cta\/:productId\/resolve'/);
  assert.match(source, /selectNextConversionTarget\(/);
  assert.match(source, /mode: 'customer_service' as const/);
  assert.match(source, /messagesComposeHref\(product\.id, product\.sectionId\)/);
  assert.match(source, /mode: 'link' as const/);
  assert.match(source, /href: target\.endpointUrl/);
  assert.match(source, /label: group\.buttonLabel/);
  assert.match(source, /Cache-Control', 'no-store'/);
});
