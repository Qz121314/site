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

  assert.match(appShell, /\.app-shell > \.bottom-nav/u);
  assert.match(appShell, /position: fixed/u);
  assert.match(appShell, /body > \.product-detail-fixed-action/u);
  assert.match(appShell, /article\.product-detail-page \.product-detail-inline-action/u);

  assert.match(homeStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(homeStyles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(homeStyles, /\.home-shortcut-icon[\s\S]*box-shadow: none/u);
  assert.match(sectionStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(sectionStyles, /\.section-category-filter button::after/u);

  assert.match(desktopSpec, /product-detail-inline-action \.cta-button/u);
  assert.match(desktopSpec, /body > \.product-detail-fixed-action/u);
});
