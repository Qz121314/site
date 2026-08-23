import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('shared navigation runtime owns SPA history direction', async () => {
  const [
    presentationSource,
    edgeNavigationSource,
    historySource,
    locationRuntimeSource,
    navigationRuntimeSource,
    messagesSource,
    homeSource,
    rootSource,
    routeTransitionSource,
  ] = await Promise.all([
    readFile(new URL('../src/StorefrontPresentation.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/MobileEdgeNavigation.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-history.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-location-runtime.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-navigation-runtime.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/MessagesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/route-transition.css', import.meta.url), 'utf8'),
  ]);

  assert.match(navigationRuntimeSource, /window\.history\.pushState/u);
  assert.match(navigationRuntimeSource, /storefront:navigate/u);
  assert.match(navigationRuntimeSource, /storefront:replace/u);
  assert.match(navigationRuntimeSource, /replaceStorefrontLocation/u);
  assert.match(
    navigationRuntimeSource,
    /window\.history\.replaceState\(window\.history\.state/u,
  );
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
  assert.doesNotMatch(navigationRuntimeSource, /startViewTransition/u);
  assert.doesNotMatch(navigationRuntimeSource, /runStorefrontViewTransition/u);

  assert.match(messagesSource, /replaceStorefrontLocation/u);
  assert.doesNotMatch(messagesSource, /window\.history\.replaceState/u);
  assert.doesNotMatch(messagesSource, /const NAVIGATION_EVENT/u);

  assert.match(homeSource, /handleStorefrontLinkClick/u);
  assert.match(rootSource, /handleStorefrontLinkClick/u);
  assert.match(rootSource, /STOREFRONT_LOCATION_EVENT/u);
  assert.doesNotMatch(rootSource, /STOREFRONT_NAVIGATION_EVENT/u);
  assert.doesNotMatch(rootSource, /addEventListener\('popstate'/u);
  assert.match(rootSource, /routeKey=\{pathname\}/u);
  assert.doesNotMatch(rootSource, /routeKey=\{locationKey\}/u);
  assert.equal((rootSource.match(/className="storefront-route-view"/gu) ?? []).length, 1);
  assert.match(locationRuntimeSource, /storefront:location/u);
  assert.match(locationRuntimeSource, /publishStorefrontLocationChange/u);

  assert.match(presentationSource, /STOREFRONT_NAVIGATION_EVENT/u);
  assert.match(presentationSource, /STOREFRONT_REPLACE_EVENT/u);
  assert.match(presentationSource, /publishStorefrontLocationChange/u);
  assert.match(presentationSource, /restoreStorefrontScrollPosition/u);
  assert.match(
    presentationSource,
    /previousPathname && previousPathname !== nextPathname/u,
  );
  assert.match(presentationSource, /dataset\.storefrontPathname = nextPathname/u);
  assert.match(presentationSource, /flushSync/u);
  assert.doesNotMatch(presentationSource, /startViewTransition/u);
  assert.doesNotMatch(presentationSource, /runStorefrontViewTransition/u);

  for (const source of [homeSource, rootSource, presentationSource]) {
    assert.doesNotMatch(source, /window\.history\.pushState/u);
    assert.doesNotMatch(source, /const NAVIGATION_EVENT/u);
  }

  assert.match(presentationSource, /recordStorefrontHistoryPush/u);
  assert.match(presentationSource, /syncStorefrontHistoryFromPopState/u);
  assert.match(presentationSource, /direction === 'back'/u);
  assert.match(presentationSource, /'pop'/u);
  assert.match(presentationSource, /'push'/u);

  assert.match(historySource, /let traversalPending = false/u);
  assert.match(historySource, /if \(traversalPending\) return false/u);
  assert.equal((historySource.match(/traversalPending = true;/gu) ?? []).length, 2);
  assert.match(
    historySource,
    /syncStorefrontHistoryFromPopState[\s\S]*traversalPending = false/u,
  );

  assert.match(routeTransitionSource, /data-storefront-transition='tab'/u);
  assert.match(routeTransitionSource, /data-storefront-transition='push'/u);
  assert.match(routeTransitionSource, /data-storefront-transition='pop'/u);
  assert.match(routeTransitionSource, /storefront-page-push-enter/u);
  assert.match(routeTransitionSource, /storefront-page-pop-enter/u);
  assert.match(routeTransitionSource, /--route-push-shift:/u);
  assert.match(routeTransitionSource, /--route-pop-shift:/u);
  assert.match(
    routeTransitionSource,
    /translate3d\(var\(--route-push-shift\), 0, 0\)/u,
  );
  assert.match(
    routeTransitionSource,
    /translate3d\(var\(--route-pop-shift\), 0, 0\)/u,
  );
  assert.doesNotMatch(routeTransitionSource, /perspective\(/u);
  assert.doesNotMatch(routeTransitionSource, /rotateY/u);
  assert.doesNotMatch(routeTransitionSource, /box-shadow/u);
  assert.doesNotMatch(routeTransitionSource, /::view-transition/u);
  assert.doesNotMatch(routeTransitionSource, /view-transition-name/u);
  assert.doesNotMatch(routeTransitionSource, /data-storefront-nav-direction/u);
  assert.doesNotMatch(routeTransitionSource, /will-change/u);
  assert.doesNotMatch(routeTransitionSource, /scale\(/u);
  assert.match(routeTransitionSource, /prefers-reduced-motion: reduce/u);

  assert.doesNotMatch(edgeNavigationSource, /recordStorefrontHistoryPush/u);
  assert.doesNotMatch(edgeNavigationSource, /syncStorefrontHistoryFromPopState/u);

  assert.match(
    historySource,
    /syncStorefrontHistoryFromPopState\([\s\S]{0,120}state: unknown[\s\S]{0,120}\): StorefrontNavigationDirection \| null/u,
  );
});
