import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configSource = await readFile(
  new URL('../src/routes/public-storefront-config.ts', import.meta.url),
  'utf8',
);
const conversionSource = await readFile(
  new URL('../src/routes/public-conversion.ts', import.meta.url),
  'utf8',
);

test('CTA metadata is read-only and /go remains the only destination resolver', () => {
  assert.match(configSource, /get\('\/cta\/:productId'/u);
  assert.match(configSource, /resolvePublicCta\(context\.env\.DB, productId\)/u);
  assert.doesNotMatch(configSource, /post\('\/cta\/:productId\/resolve'/u);
  assert.doesNotMatch(configSource, /selectNextConversionTarget\(/u);

  assert.match(conversionSource, /get\('\/:code'/u);
  assert.match(conversionSource, /selectNextConversionTarget\(/u);
  assert.match(conversionSource, /context\.redirect\(/u);
});
