import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('internal navigation preloads lazy route chunks and article content from user intent', async () => {
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
  assert.match(source, /import\('\.\/ArticlePage'\)/u);
  assert.match(source, /loadArticleSnapshot/u);
  assert.match(source, /prefetchQuery/u);
  assert.doesNotMatch(source, /fetch\(/u);
});
