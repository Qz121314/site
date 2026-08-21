import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('storefront typography buttons and route motion share one app visual contract', async () => {
  const [typography, theme, transitions, appShell, main] = await Promise.all([
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
    readFile(new URL('../src/route-transition.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(typography, /--storefront-weight-regular:/u);
  assert.match(typography, /--storefront-weight-medium:/u);
  assert.match(typography, /--storefront-weight-semibold:/u);
  assert.match(typography, /-webkit-font-smoothing: antialiased/u);
  assert.match(typography, /font-feature-settings:[\s\S]*'kern' 1/u);
  assert.match(
    typography,
    /:is\(\.browse-directory-search input, \.section-catalog-search input\)/u,
  );

  assert.match(theme, /--theme-button-shadow:/u);
  assert.match(theme, /--theme-button-press-shadow:/u);
  assert.match(theme, /--theme-button-focus-ring:/u);
  assert.match(theme, /--theme-search-focus-ring:/u);
  assert.match(
    theme,
    /:is\(\.cta-button, \.product-detail-fixed-action \.cta-button\)[\s\S]*box-shadow: var\(--theme-detail-cta-shadow, var\(--theme-button-shadow\)\)/u,
  );
  assert.match(theme, /\.section-tag-filter button \{[\s\S]*min-height: 34px/u);
  assert.match(
    theme,
    /\.section-category-filter button,[\s\S]*\.section-tag-filter button/u,
  );
  assert.match(
    theme,
    /:is\(\.browse-directory-search, \.section-catalog-search\)/u,
  );
  assert.match(
    theme,
    /:is\(\.section-catalog-back, \.faq-back-link, \.product-detail-back\)/u,
  );
  assert.match(theme, /\.bottom-nav a:focus-visible/u);

  assert.match(transitions, /--storefront-route-shift:/u);
  assert.match(
    transitions,
    /data-storefront-transition='push'\]\[data-storefront-nav-direction='forward'/u,
  );
  assert.match(transitions, /animation: storefront-push-enter var\(--app-motion-base/u);
  assert.match(transitions, /animation: storefront-pop-enter var\(--app-motion-base/u);
  assert.match(transitions, /prefers-reduced-motion: reduce/u);
  assert.doesNotMatch(appShell, /animation: app-page-enter-forward/u);
  assert.doesNotMatch(appShell, /@keyframes app-page-enter-forward/u);
  assert.ok(main.indexOf('./app-shell.css') < main.indexOf('./route-transition.css'));
});
