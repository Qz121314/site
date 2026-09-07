import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('shared navigation runtime owns SPA history direction and scroll restoration', async () => {
  const [historySource, navigationSource, presentationSource, rootSource] =
    await Promise.all([
      readFile(new URL('../src/storefront-history.ts', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/storefront-navigation-runtime.ts', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/StorefrontPresentation.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
    ]);

  assert.match(navigationSource, /window\.history\.pushState/u);
  assert.match(navigationSource, /saveCurrentStorefrontScrollPosition/u);
  assert.match(navigationSource, /normalizedLocationKey/u);
  assert.match(navigationSource, /storefront:navigate/u);
  assert.match(navigationSource, /storefront:replace/u);
  assert.doesNotMatch(navigationSource, /startViewTransition/u);

  assert.match(rootSource, /handleStorefrontLinkClick/u);
  assert.doesNotMatch(rootSource, /window\.history\.pushState/u);
  assert.doesNotMatch(rootSource, /addEventListener\('popstate'/u);

  assert.match(presentationSource, /STOREFRONT_NAVIGATION_EVENT/u);
  assert.match(presentationSource, /STOREFRONT_REPLACE_EVENT/u);
  assert.match(presentationSource, /restoreStorefrontScrollPosition/u);
  assert.match(presentationSource, /recordStorefrontHistoryPush/u);
  assert.match(presentationSource, /syncStorefrontHistoryFromPopState/u);

  assert.match(historySource, /let traversalPending = false/u);
  assert.match(historySource, /if \(traversalPending\) return false/u);
});
