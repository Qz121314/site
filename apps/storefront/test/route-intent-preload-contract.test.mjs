import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('internal navigation preloads lazy route chunks from user intent without API requests', async () => {
  const source = await readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8');

  assert.match(source, /preloadStorefrontRoute/u);
  assert.match(source, /onPointerEnter/u);
  assert.match(source, /onPointerDown/u);
  assert.match(source, /onFocus/u);
  assert.doesNotMatch(source, /preloadStorefrontRoute[\s\S]{0,500}fetch\(/u);
});
