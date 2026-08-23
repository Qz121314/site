import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('storefront typography buttons and route motion share one app visual contract', async () => {
  const [typography, theme, chrome, transitions, appShell, main] = await Promise.all([
    readFile(
      new URL(
        '../../../packages/storefront-ui/src/typography-contract.css',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(
      new URL('../../../packages/storefront-ui/src/theme-contract.css', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../src/app-chrome.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/route-transition.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(typography, /--storefront-weight-regular:/u);
  assert.match(typography, /--storefront-weight-medium:/u);
  assert.match(typography, /--storefront-weight-semibold:/u);
  assert.match(typography, /-webkit-font-smoothing: antialiased/u);
  assert.match(typography, /font-feature-settings:[\s\S]*'kern' 1/u);

  assert.match(theme, /--theme-button-shadow:/u);
  assert.match(theme, /--theme-button-press-shadow:/u);
  assert.match(theme, /--theme-button-focus-ring:/u);
  assert.match(
    theme,
    /:is\(\.cta-button, \.product-detail-route-action \.cta-button\)[\s\S]*box-shadow: var\(--theme-detail-cta-shadow, var\(--theme-button-shadow\)\)/u,
  );
  assert.doesNotMatch(theme, /product-detail-fixed-action/u);
  assert.match(theme, /\.section-tag-filter button \{[\s\S]*min-height: 34px/u);
  assert.match(
    theme,
    /\.section-category-filter button,[\s\S]*\.section-tag-filter button/u,
  );

  assert.match(chrome, /--theme-search-focus-ring:/u);
  assert.match(chrome, /\.app-shell > \.topbar/u);
  assert.match(chrome, /:is\(\.browse-directory-search, \.section-catalog-search\)/u);
  assert.match(
    chrome,
    /:is\(\.section-catalog-back, \.faq-back-link, \.storefront-detail-back\)/u,
  );
  assert.doesNotMatch(chrome, /product-detail-back/u);
  assert.match(chrome, /\.bottom-nav a:focus-visible/u);
  assert.match(chrome, /\.storefront-bottom-chrome > \.bottom-nav/u);
  assert.doesNotMatch(chrome, /\.app-shell > \.bottom-nav/u);
  assert.match(chrome, /--storefront-weight-regular/u);
  assert.match(chrome, /--storefront-weight-semibold/u);

  assert.match(transitions, /--route-push-shift:/u);
  assert.match(transitions, /--route-pop-shift:/u);
  assert.match(transitions, /data-storefront-transition='push'/u);
  assert.match(transitions, /data-storefront-transition='pop'/u);
  assert.doesNotMatch(transitions, /data-storefront-nav-direction/u);
  assert.match(
    transitions,
    /animation: storefront-page-push-enter var\(--app-motion-base/u,
  );
  assert.match(
    transitions,
    /animation: storefront-page-pop-enter var\(--app-motion-base/u,
  );
  assert.match(transitions, /translate3d\(var\(--route-push-shift\), 0, 0\)/u);
  assert.match(transitions, /translate3d\(var\(--route-pop-shift\), 0, 0\)/u);
  assert.match(
    transitions,
    /@media \(min-width: 768px\)[\s\S]*--route-push-shift: 0px;[\s\S]*--route-pop-shift: 0px;/u,
  );
  assert.doesNotMatch(transitions, /perspective\(/u);
  assert.doesNotMatch(transitions, /rotateY/u);
  assert.doesNotMatch(transitions, /box-shadow/u);
  assert.doesNotMatch(transitions, /transform-origin/u);
  assert.doesNotMatch(transitions, /::view-transition/u);
  assert.match(transitions, /prefers-reduced-motion: reduce/u);
  assert.doesNotMatch(appShell, /animation: app-page-enter-forward/u);
  assert.doesNotMatch(appShell, /@keyframes app-page-enter-forward/u);
  assert.ok(main.indexOf('./app-shell.css') < main.indexOf('./route-transition.css'));
  assert.ok(
    main.indexOf('@site/storefront-ui/typography-contract.css') <
      main.indexOf('./app-chrome.css'),
  );
});
