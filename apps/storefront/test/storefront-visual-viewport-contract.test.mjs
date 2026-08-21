import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Storefront chrome follows the visual viewport and measured shell geometry', async () => {
  const [main, runtime, root, shell, section, pwa, themeRuntime, indexHtml] =
    await Promise.all([
      read('../src/main.tsx'),
      read('../src/storefront-viewport-runtime.ts'),
      read('../src/StorefrontRoot.tsx'),
      read('../src/app-shell.css'),
      read('../src/section-ui.css'),
      read('../src/pwa.css'),
      read('../src/theme-runtime.ts'),
      read('../index.html'),
    ]);

  assert.match(main, /installStorefrontViewportRuntime\(\)/u);

  assert.match(runtime, /window\.visualViewport/u);
  assert.match(runtime, /addEventListener\('resize'/u);
  assert.match(runtime, /addEventListener\('scroll'/u);
  assert.match(runtime, /orientationchange/u);
  assert.match(runtime, /--app-viewport-height/u);
  assert.match(runtime, /--app-viewport-top/u);
  assert.match(runtime, /--app-viewport-bottom/u);
  assert.match(runtime, /ResizeObserver/u);
  assert.match(runtime, /--app-header-height/u);
  assert.match(runtime, /--app-bottom-nav-height/u);
  assert.match(runtime, /--app-route-action-height/u);

  assert.match(root, /observeStorefrontShellChrome/u);
  assert.match(root, /ref=\{shellRef\}/u);

  assert.match(
    shell,
    /\.app-shell > \.topbar \{[\s\S]*position: fixed;[\s\S]*top: var\(--app-viewport-top/u,
  );
  assert.match(
    shell,
    /\.storefront-route-action-host \{[\s\S]*bottom: var\(--app-viewport-bottom/u,
  );
  assert.match(shell, /\.app-shell > main \{[\s\S]*var\(--app-header-height/u);
  assert.match(shell, /var\(--app-route-action-height/u);
  assert.match(shell, /var\(--app-bottom-nav-height/u);
  assert.doesNotMatch(shell, /max\(var\(--theme-detail-cta-height[\s\S]{0,160}\+ 58px/u);

  assert.match(section, /var\(--app-viewport-height/u);
  assert.match(section, /var\(--app-bottom-nav-height/u);
  assert.doesNotMatch(section, /100dvh - 68px/u);

  assert.match(pwa, /var\(--app-viewport-bottom/u);
  assert.match(pwa, /var\(--app-bottom-nav-height/u);

  assert.match(themeRuntime, /syncThemeColor\(theme\.tokens\.pageBg\)/u);
  assert.match(indexHtml, /interactive-widget=resizes-content/u);
});
