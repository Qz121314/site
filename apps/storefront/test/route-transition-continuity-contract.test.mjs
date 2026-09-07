import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('route transitions commit one live surface and restore history scroll without browser snapshots', async () => {
  const [historyRuntime, navigationRuntime, presentationSource, rootSource] =
    await Promise.all([
      readFile(new URL('../src/storefront-history.ts', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/storefront-navigation-runtime.ts', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/StorefrontPresentation.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
    ]);

  assert.doesNotMatch(navigationRuntime, /startViewTransition/u);
  assert.doesNotMatch(presentationSource, /startViewTransition/u);
  assert.match(presentationSource, /flushSync/u);
  assert.match(presentationSource, /restoreStorefrontScrollPosition\(event\.state\)/u);

  const immediateRestore = historyRuntime.indexOf('restore();');
  const scheduledRestore = historyRuntime.indexOf('window.requestAnimationFrame');
  assert.notEqual(immediateRestore, -1);
  assert.notEqual(scheduledRestore, -1);
  assert.ok(immediateRestore < scheduledRestore);

  assert.equal((rootSource.match(/className="storefront-route-view"/gu) ?? []).length, 1);
});
