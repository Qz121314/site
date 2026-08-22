import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('view transitions stay mobile and hierarchical', async () => {
  const transitionRuntime = await readFile(
    new URL('../src/storefront-view-transition.ts', import.meta.url),
    'utf8',
  );

  assert.match(transitionRuntime, /MOBILE_ROUTE_TRANSITION_QUERY/u);
  assert.match(transitionRuntime, /\(max-width: 767px\)/u);
  assert.match(transitionRuntime, /!usesCompactRouteMotion\(\)/u);
  assert.match(transitionRuntime, /storefrontPresentationMode\(fromPathname\)/u);
  assert.match(transitionRuntime, /storefrontPresentationMode\(toPathname\)/u);
  assert.match(transitionRuntime, /fromMode === 'root'/u);
  assert.match(transitionRuntime, /toMode === 'root'/u);
});

test('route snapshots stay opaque, atomic, and scroll-stable', async () => {
  const transitionRuntime = await readFile(
    new URL('../src/storefront-view-transition.ts', import.meta.url),
    'utf8',
  );
  const historyRuntime = await readFile(
    new URL('../src/storefront-history.ts', import.meta.url),
    'utf8',
  );
  const navigationRuntime = await readFile(
    new URL('../src/storefront-navigation-runtime.ts', import.meta.url),
    'utf8',
  );
  const presentationSource = await readFile(
    new URL('../src/StorefrontPresentation.tsx', import.meta.url),
    'utf8',
  );
  const transitionStyles = await readFile(
    new URL('../src/route-transition.css', import.meta.url),
    'utf8',
  );

  assert.match(transitionRuntime, /startViewTransition/u);
  assert.match(transitionRuntime, /prefers-reduced-motion: reduce/u);
  assert.match(transitionRuntime, /shouldUseStorefrontViewTransition/u);
  assert.match(transitionRuntime, /storefrontViewTransition = 'active'/u);
  assert.match(transitionRuntime, /flushSync/u);
  assert.match(transitionRuntime, /flushSync\(update\)/u);
  assert.match(transitionRuntime, /afterCommit/u);
  assert.match(transitionRuntime, /afterCommit\?\.\(\)/u);
  assert.doesNotMatch(transitionRuntime, /setTimeout/u);
  assert.doesNotMatch(transitionRuntime, /waitForRouteCommit/u);

  assert.match(navigationRuntime, /runStorefrontViewTransition\(navigate\)/u);
  assert.match(presentationSource, /runStorefrontViewTransition\(update, restore\)/u);
  assert.match(presentationSource, /restoreStorefrontScrollPosition/u);

  const immediateRestore = historyRuntime.indexOf('restore();');
  const scheduledRestore = historyRuntime.indexOf('window.requestAnimationFrame');
  assert.notEqual(immediateRestore, -1);
  assert.notEqual(scheduledRestore, -1);
  assert.ok(immediateRestore < scheduledRestore);

  assert.match(transitionStyles, /view-transition-name: storefront-route/u);
  assert.match(transitionStyles, /isolation: isolate/u);
  assert.match(transitionStyles, /overflow: clip/u);
  assert.match(transitionStyles, /background: var\(--page-bg/u);
  assert.match(transitionStyles, /opacity: 1/u);
  assert.match(transitionStyles, /data-storefront-transition='push'/u);
  assert.match(transitionStyles, /data-storefront-transition='pop'/u);
  assert.equal((transitionStyles.match(/z-index: 1;/gu) ?? []).length, 2);
  assert.equal((transitionStyles.match(/z-index: 2;/gu) ?? []).length, 2);

  const nativeMotionStart = transitionStyles.indexOf(
    '@keyframes storefront-native-push-old',
  );
  assert.notEqual(nativeMotionStart, -1);
  const nativeMotion = transitionStyles.slice(nativeMotionStart);
  assert.doesNotMatch(nativeMotion, /opacity:\s*0\./u);
});
