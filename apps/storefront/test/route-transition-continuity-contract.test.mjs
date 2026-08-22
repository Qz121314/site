import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('route motion commits one live surface without browser snapshots', async () => {
  const [
    historyRuntime,
    navigationRuntime,
    presentationSource,
    rootSource,
    transitionStyles,
  ] = await Promise.all([
    readFile(new URL('../src/storefront-history.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-navigation-runtime.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/StorefrontPresentation.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/route-transition.css', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(navigationRuntime, /storefront-view-transition/u);
  assert.doesNotMatch(navigationRuntime, /startViewTransition/u);
  assert.doesNotMatch(navigationRuntime, /runStorefrontViewTransition/u);
  assert.doesNotMatch(presentationSource, /storefront-view-transition/u);
  assert.doesNotMatch(presentationSource, /startViewTransition/u);
  assert.doesNotMatch(presentationSource, /runStorefrontViewTransition/u);

  assert.match(
    presentationSource,
    /flushSync\(\(\) => commitStorefrontLocation\('forward'\)\)/u,
  );
  assert.match(
    presentationSource,
    /flushSync\(\(\) => commitStorefrontLocation\(direction\)\)/u,
  );
  assert.match(
    presentationSource,
    /restoreStorefrontScrollPosition\(event\.state\)/u,
  );

  const immediateRestore = historyRuntime.indexOf('restore();');
  const scheduledRestore = historyRuntime.indexOf('window.requestAnimationFrame');
  assert.notEqual(immediateRestore, -1);
  assert.notEqual(scheduledRestore, -1);
  assert.ok(immediateRestore < scheduledRestore);

  assert.equal(
    (rootSource.match(/className="storefront-route-view"/gu) ?? []).length,
    1,
  );
  assert.match(rootSource, /className="storefront-route-view" key=\{routeKey\}/u);

  assert.match(transitionStyles, /data-storefront-transition='push'/u);
  assert.match(transitionStyles, /data-storefront-transition='pop'/u);
  assert.match(transitionStyles, /@keyframes storefront-page-push-enter/u);
  assert.match(transitionStyles, /@keyframes storefront-page-pop-enter/u);
  assert.match(transitionStyles, /perspective\(1200px\)/u);
  assert.match(transitionStyles, /rotateY/u);
  assert.match(transitionStyles, /backface-visibility: hidden/u);
  assert.match(transitionStyles, /background: var\(--page-bg/u);

  assert.doesNotMatch(transitionStyles, /::view-transition/u);
  assert.doesNotMatch(transitionStyles, /view-transition-name/u);
  assert.doesNotMatch(transitionStyles, /data-storefront-view-transition/u);
  assert.doesNotMatch(transitionStyles, /storefront-native-(?:push|pop)/u);
});
