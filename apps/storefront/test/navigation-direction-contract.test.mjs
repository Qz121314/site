import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('presentation owns history direction before choosing route transitions', async () => {
  const [presentationSource, edgeNavigationSource, historySource] =
    await Promise.all([
      readFile(new URL('../src/StorefrontPresentation.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/MobileEdgeNavigation.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/storefront-history.ts', import.meta.url), 'utf8'),
    ]);

  assert.match(presentationSource, /recordStorefrontHistoryPush/u);
  assert.match(presentationSource, /syncStorefrontHistoryFromPopState/u);
  assert.match(presentationSource, /direction === 'back'/u);
  assert.match(presentationSource, /'pop'/u);
  assert.match(presentationSource, /'push'/u);

  assert.doesNotMatch(edgeNavigationSource, /recordStorefrontHistoryPush/u);
  assert.doesNotMatch(edgeNavigationSource, /syncStorefrontHistoryFromPopState/u);

  assert.match(
    historySource,
    /syncStorefrontHistoryFromPopState\([\s\S]{0,120}state: unknown[\s\S]{0,120}\): StorefrontNavigationDirection \| null/u,
  );
});
