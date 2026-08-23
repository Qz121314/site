import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browse search remembers product summaries for later product detail navigation', async () => {
  const source = await readFile(
    new URL('../src/search-index.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /rememberStorefrontProducts\(bootstrap, products\)/u);
});

test('product detail checks remembered summaries before section fallback', async () => {
  const source = await readFile(
    new URL('../src/content-route.ts', import.meta.url),
    'utf8',
  );
  const remembered = source.indexOf('matchedProduct = findRememberedProduct');
  const fallback = source.indexOf(
    'const sectionSnapshot = await loadSectionSnapshot',
    remembered,
  );
  assert.ok(remembered >= 0);
  assert.ok(fallback > remembered);
});
