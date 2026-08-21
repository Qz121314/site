import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('shared navigation runtime owns SPA push and route direction', async () => {
  const [
    presentationSource,
    edgeNavigationSource,
    historySource,
    navigationRuntimeSource,
    homeSource,
    rootSource,
  ] = await Promise.all([
    readFile(new URL('../src/StorefrontPresentation.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/MobileEdgeNavigation.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-history.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-navigation-runtime.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(navigationRuntimeSource, /window\.history\.pushState/u);
  assert.match(navigationRuntimeSource, /storefront:navigate/u);
  assert.match(navigationRuntimeSource, /saveCurrentStorefrontScrollPosition/u);
  assert.match(navigationRuntimeSource, /normalizedLocationKey/u);
  assert.match(
    navigationRuntimeSource,
    /normalizedLocationKey\(target\) === normalizedLocationKey\(current\)/u,
  );
  assert.ok(
    navigationRuntimeSource.indexOf('saveCurrentStorefrontScrollPosition()') <
      navigationRuntimeSource.indexOf('window.history.pushState'),
  );
  assert.match(homeSource, /handleStorefrontLinkClick/u);
  assert.match(rootSource, /handleStorefrontLinkClick/u);
  assert.match(rootSource, /routeKey=\{pathname\}/u);
  assert.doesNotMatch(rootSource, /routeKey=\{locationKey\}/u);
  assert.match(presentationSource, /STOREFRONT_NAVIGATION_EVENT/u);
  assert.match(
    presentationSource,
    /previousPathname && previousPathname !== nextPathname/u,
  );
  assert.match(presentationSource, /dataset\.storefrontPathname = nextPathname/u);

  for (const source of [homeSource, rootSource, presentationSource]) {
    assert.doesNotMatch(source, /window\.history\.pushState/u);
    assert.doesNotMatch(source, /const NAVIGATION_EVENT/u);
  }

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
