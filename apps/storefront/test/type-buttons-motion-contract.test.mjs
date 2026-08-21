import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('storefront typography buttons and route motion share one app visual contract', async () => {
  const [typography, theme, transitions, shell, detail, section] = await Promise.all([
    readFile(
      new URL('../../../packages/storefront-ui/src/typography-contract.css', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../../../packages/storefront-ui/src/theme-contract.css', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../src/route-transition.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8'),
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
    /:is\(\.cta-button, \.product-detail-fixed-action \.cta-button\)[\s\S]*box-shadow: var\(--theme-button-shadow/u,
  );
  assert.match(detail, /font-weight: var\(--storefront-weight-semibold/u);
  assert.match(section, /\.section-tag-filter button \{[\s\S]*min-height: 34px/u);

  assert.match(transitions, /--storefront-route-shift:/u);
  assert.match(transitions, /animation: storefront-push-enter var\(--app-motion-base/u);
  assert.match(transitions, /animation: storefront-pop-enter var\(--app-motion-base/u);
  assert.match(transitions, /prefers-reduced-motion: reduce/u);
  assert.doesNotMatch(shell, /app-page-enter-forward|app-page-enter-back/u);
});
