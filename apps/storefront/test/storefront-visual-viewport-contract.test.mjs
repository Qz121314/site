import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Storefront chrome follows the visual viewport and measured shell geometry', async () => {
  const [
    main,
    runtime,
    root,
    shell,
    section,
    browse,
    loading,
    pwa,
    themeRuntime,
    indexHtml,
  ] = await Promise.all([
    read('../src/main.tsx'),
    read('../src/storefront-viewport-runtime.ts'),
    read('../src/StorefrontRoot.tsx'),
    read('../src/app-shell.css'),
    read('../src/section-ui.css'),
    read('../src/browse-ui.css'),
    read('../src/loading-states.css'),
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
  assert.match(runtime, /--app-bottom-chrome-height/u);
  assert.doesNotMatch(runtime, /--app-bottom-nav-height/u);
  assert.doesNotMatch(runtime, /--app-route-action-height/u);

  assert.match(root, /observeStorefrontShellChrome/u);
  assert.match(root, /ref=\{shellRef\}/u);
  assert.match(root, /className="storefront-bottom-chrome"/u);

  assert.match(
    shell,
    /\.app-shell > \.topbar \{[\s\S]*position: fixed;[\s\S]*top: var\(--app-viewport-top/u,
  );
  assert.match(
    shell,
    /\.storefront-bottom-chrome \{[\s\S]*position: fixed;[\s\S]*bottom: var\(--app-viewport-bottom/u,
  );
  assert.match(shell, /\.app-shell \{[\s\S]{0,700}padding-bottom: 0;/u);
  assert.match(shell, /\.app-shell > main \{[\s\S]*var\(--app-header-height/u);
  assert.match(
    shell,
    /\.app-shell > main \{[\s\S]{0,700}padding-bottom: calc\([\s\S]{0,180}--app-bottom-chrome-height/u,
  );
  assert.match(shell, /var\(--app-bottom-chrome-height/u);
  assert.doesNotMatch(shell, /var\(--app-route-action-height/u);
  assert.doesNotMatch(shell, /var\(--app-bottom-nav-height/u);
  assert.doesNotMatch(shell, /max\(var\(--theme-detail-cta-height[\s\S]{0,160}\+ 58px/u);

  assert.match(section, /var\(--app-viewport-height/u);
  assert.match(section, /var\(--app-bottom-chrome-height/u);
  assert.doesNotMatch(section, /var\(--app-bottom-nav-height/u);
  assert.doesNotMatch(section, /100dvh - 68px/u);

  assert.match(
    browse,
    /@media \(max-width: 767px\) \{[\s\S]{0,420}\.browse-directory-search \{[\s\S]{0,180}position: sticky;[\s\S]{0,180}--app-viewport-top[\s\S]{0,180}--app-header-height/u,
  );
  assert.doesNotMatch(browse, /top: calc\(58px/u);

  assert.match(loading, /--startup-header-height/u);
  assert.match(loading, /--startup-bottom-chrome-height/u);
  assert.match(
    loading,
    /\.startup-app-bar \{[\s\S]{0,260}position: fixed;[\s\S]{0,180}--app-viewport-top/u,
  );
  assert.match(
    loading,
    /\.startup-feed-skeleton \{[\s\S]{0,720}--app-viewport-top[\s\S]{0,360}--startup-bottom-chrome-height/u,
  );
  assert.doesNotMatch(loading, /padding-bottom: calc\([\s\S]{0,40}72px/u);

  const tabletLoading = loading.slice(
    loading.indexOf('@media (min-width: 768px)'),
    loading.indexOf('@media (min-width: 980px)'),
  );
  const desktopLoading = loading.slice(loading.indexOf('@media (min-width: 980px)'));
  assert.doesNotMatch(
    tabletLoading,
    /\.startup-bottom-nav-skeleton \{[\s\S]{0,300}display: none/u,
  );
  assert.match(
    desktopLoading,
    /\.startup-bottom-nav-skeleton \{[\s\S]{0,120}display: none/u,
  );

  assert.match(pwa, /var\(--app-viewport-bottom/u);
  assert.match(pwa, /var\(--app-bottom-chrome-height/u);
  assert.doesNotMatch(pwa, /var\(--app-bottom-nav-height/u);

  assert.match(themeRuntime, /syncThemeColor\(theme\.tokens\.pageBg\)/u);
  assert.match(indexHtml, /interactive-widget=resizes-content/u);
});
