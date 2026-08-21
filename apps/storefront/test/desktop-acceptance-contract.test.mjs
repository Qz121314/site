import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('desktop production acceptance and visual v2 shell remain wired', async () => {
  const [configSource, mainSource, appShell, homeStyles, sectionStyles, desktopSpec] =
    await Promise.all([
      readFile(new URL('../../../playwright.config.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/home-feed.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8'),
      readFile(
        new URL('../../../tests/e2e/desktop-production.spec.ts', import.meta.url),
        'utf8',
      ),
    ]);

  assert.match(configSource, /name: 'desktop-chromium'/u);
  assert.match(configSource, /devices\['Desktop Chrome'\]/u);
  assert.match(configSource, /desktop-production\\\.spec\\\.ts/u);
  assert.match(mainSource, /import '\.\/app-shell\.css';/u);
  assert.doesNotMatch(mainSource, /desktop-shell\.css/u);

  assert.match(appShell, /\.storefront-bottom-chrome \{[\s\S]*position: fixed/u);
  assert.match(appShell, /\.storefront-bottom-chrome > \.bottom-nav \{[\s\S]*position: static/u);
  assert.match(appShell, /\.storefront-route-action-host \{[\s\S]*pointer-events: none/u);
  assert.doesNotMatch(appShell, /\.storefront-route-action-host \{[\s\S]{0,220}position: fixed/u);
  assert.match(appShell, /\.storefront-detail-topbar \{/u);
  assert.match(appShell, /article\.product-detail-page \.product-detail-inline-action/u);
  assert.doesNotMatch(appShell, /body > \.product-detail-fixed-action/u);

  assert.match(homeStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(homeStyles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(homeStyles, /\.home-shortcut-icon[\s\S]*box-shadow: none/u);
  assert.match(sectionStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(sectionStyles, /\.section-category-filter button::after/u);

  assert.match(desktopSpec, /\.app-shell > \.storefront-bottom-chrome > \.bottom-nav/u);
  assert.match(desktopSpec, /bottomChromePosition/u);
  assert.match(desktopSpec, /navigationPosition/u);
  assert.match(desktopSpec, /toBe\('fixed'\)/u);
  assert.match(desktopSpec, /toBe\('static'\)/u);
  assert.match(desktopSpec, /product-detail-inline-action \.cta-button/u);
  assert.match(
    desktopSpec,
    /\.storefront-route-action-host \.product-detail-route-action/u,
  );
  assert.match(desktopSpec, /\.app-shell > \.storefront-detail-topbar/u);
  assert.doesNotMatch(desktopSpec, /\.app-shell > \.bottom-nav/u);
  assert.doesNotMatch(desktopSpec, /body > \.product-detail-fixed-action/u);
});
