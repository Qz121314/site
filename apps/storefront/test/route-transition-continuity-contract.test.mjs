import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { shouldUseStorefrontViewTransition } from '../src/storefront-view-transition.ts';

test('root tabs stay lightweight while hierarchical routes opt into view transitions', () => {
  assert.equal(shouldUseStorefrontViewTransition('/', '/browse/'), false);
  assert.equal(shouldUseStorefrontViewTransition('/browse/', '/faq/'), false);
  assert.equal(
    shouldUseStorefrontViewTransition('/browse/', '/sections/demo-section/'),
    true,
  );
  assert.equal(
    shouldUseStorefrontViewTransition(
      '/sections/demo-section/',
      '/sections/demo-section/products/demo-product/',
    ),
    true,
  );
  assert.equal(
    shouldUseStorefrontViewTransition('/sections/demo-section/', '/browse/'),
    true,
  );
});

test('hierarchical navigation transitions only route content and keeps persistent chrome stable', async () => {
  const [transitionRuntime, navigationRuntime, presentationSource, transitionStyles] =
    await Promise.all([
      readFile(new URL('../src/storefront-view-transition.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/storefront-navigation-runtime.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/StorefrontPresentation.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/route-transition.css', import.meta.url), 'utf8'),
    ]);

  assert.match(transitionRuntime, /startViewTransition/u);
  assert.match(transitionRuntime, /prefers-reduced-motion: reduce/u);
  assert.match(transitionRuntime, /shouldUseStorefrontViewTransition/u);
  assert.match(transitionRuntime, /fromMode === 'root' && toMode === 'root'/u);
  assert.match(transitionRuntime, /dataset\.storefrontViewTransition = 'active'/u);
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
    /data-storefront-view-transition='active'[\s\S]*::view-transition-old\(root\)[\s\S]*animation: none/u,
  );
  assert.match(
    transitionStyles,
    /::view-transition-old\([\s\S]*storefront-top-chrome[\s\S]*\)[\s\S]*opacity: 0/u,
  );
  assert.match(
    transitionStyles,
    /::view-transition-new\([\s\S]*storefront-bottom-chrome[\s\S]*\)[\s\S]*opacity: 1/u,
  );
  assert.match(
    transitionStyles,
    /data-storefront-transition='push'[\s\S]*::view-transition-new\([\s\S]*storefront-route/u,
  );
  assert.match(
    transitionStyles,
    /data-storefront-transition='pop'[\s\S]*::view-transition-new\([\s\S]*storefront-route/u,
  );
  assert.match(
    transitionStyles,
    /data-storefront-view-transition='active'[\s\S]*\.storefront-route-view[\s\S]*animation: none/u,
  );
});
