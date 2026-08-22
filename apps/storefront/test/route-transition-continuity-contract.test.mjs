import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('root tabs and desktop stay light while mobile hierarchy uses view transitions', async () => {
  const transitionRuntime = await readFile(
    new URL('../src/storefront-view-transition.ts', import.meta.url),
    'utf8',
  );

  assert.match(transitionRuntime, /MOBILE_ROUTE_TRANSITION_QUERY/u);
  assert.match(transitionRuntime, /\(max-width: 767px\)/u);
  assert.match(transitionRuntime, /!usesCompactRouteMotion\(\)/u);
  assert.match(
    transitionRuntime,
    /const fromMode = storefrontPresentationMode\(fromPathname\);/u,
  );
  assert.match(
    transitionRuntime,
    /const toMode = storefrontPresentationMode\(toPathname\);/u,
  );
  assert.match(
    transitionRuntime,
    /return !\(fromMode === 'root' && toMode === 'root'\);/u,
  );
});

test('hierarchical navigation commits atomically and keeps page snapshots opaque', async () => {
  const [transitionRuntime, navigationRuntime, presentationSource, transitionStyles] =
    await Promise.all([
      readFile(new URL('../src/storefront-view-transition.ts', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/storefront-navigation-runtime.ts', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/StorefrontPresentation.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/route-transition.css', import.meta.url), 'utf8'),
    ]);

  assert.match(transitionRuntime, /startViewTransition/u);
  assert.match(transitionRuntime, /prefers-reduced-motion: reduce/u);
  assert.match(transitionRuntime, /shouldUseStorefrontViewTransition/u);
  assert.match(transitionRuntime, /fromMode === 'root' && toMode === 'root'/u);
  assert.match(transitionRuntime, /dataset\.storefrontViewTransition = 'active'/u);
  assert.match(transitionRuntime, /import \{ flushSync \} from 'react-dom';/u);
  assert.match(transitionRuntime, /flushSync\(update\)/u);
  assert.doesNotMatch(transitionRuntime, /setTimeout/u);
  assert.doesNotMatch(transitionRuntime, /waitForRouteCommit/u);
  assert.doesNotMatch(transitionRuntime, /storefrontViewTransitionMode/u);

  assert.match(navigationRuntime, /shouldUseStorefrontViewTransition/u);
  assert.match(navigationRuntime, /runStorefrontViewTransition\(navigate\)/u);
  assert.match(presentationSource, /shouldUseStorefrontViewTransition/u);
  assert.match(presentationSource, /runStorefrontViewTransition\(update\)/u);

  assert.match(transitionStyles, /view-transition-name: storefront-top-chrome/u);
  assert.match(transitionStyles, /view-transition-name: storefront-bottom-chrome/u);
  assert.match(transitionStyles, /view-transition-name: storefront-route/u);
  assert.match(
    transitionStyles,
    /\.storefront-route-view \{[\s\S]*isolation: isolate;[\s\S]*background: var\(--page-bg/u,
  );
  assert.match(
    transitionStyles,
    /::view-transition-image-pair\([\s\S]*storefront-route[\s\S]*\)[\s\S]*overflow: clip/u,
  );
  assert.match(
    transitionStyles,
    /::view-transition-old\(storefront-route\),[\s\S]*::view-transition-new\(storefront-route\)[\s\S]*opacity: 1;[\s\S]*background: var\(--page-bg/u,
  );
  assert.match(
    transitionStyles,
    /data-storefront-transition='push'[\s\S]*::view-transition-old\([\s\S]*storefront-route[\s\S]*z-index: 1/u,
  );
  assert.match(
    transitionStyles,
    /data-storefront-transition='push'[\s\S]*::view-transition-new\([\s\S]*storefront-route[\s\S]*z-index: 2/u,
  );
  assert.match(
    transitionStyles,
    /data-storefront-transition='pop'[\s\S]*::view-transition-old\([\s\S]*storefront-route[\s\S]*z-index: 2/u,
  );
  assert.match(
    transitionStyles,
    /data-storefront-transition='pop'[\s\S]*::view-transition-new\([\s\S]*storefront-route[\s\S]*z-index: 1/u,
  );
  assert.match(
    transitionStyles,
    /data-storefront-view-transition='active'[\s\S]*\.storefront-route-view[\s\S]*animation: none/u,
  );

  const nativeMotionStart = transitionStyles.indexOf('@keyframes storefront-native-push-old');
  assert.notEqual(nativeMotionStart, -1);
  const nativeMotion = transitionStyles.slice(nativeMotionStart);
  assert.doesNotMatch(nativeMotion, /opacity:\s*0\./u);
});
