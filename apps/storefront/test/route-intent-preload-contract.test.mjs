import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('internal navigation preloads lazy route chunks from user intent without API requests', async () => {
  const source = await readFile(
    new URL('../src/StorefrontRoutePreload.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /preloadStorefrontRoute/u);
  assert.match(source, /pointerover/u);
  assert.match(source, /pointerdown/u);
  assert.match(source, /focusin/u);
  assert.match(source, /import\('\.\/BrowsePage'\)/u);
  assert.match(source, /import\('\.\/ProductDetailPage'\)/u);
  assert.doesNotMatch(source, /fetch\(/u);
});
