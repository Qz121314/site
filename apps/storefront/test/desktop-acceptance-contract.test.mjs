import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('desktop production acceptance and shell corrections remain wired', async () => {
  const [configSource, mainSource, desktopStyles, desktopSpec] = await Promise.all([
    readFile(new URL('../../../playwright.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/desktop-shell.css', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../tests/e2e/desktop-production.spec.ts', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(configSource, /name: 'desktop-chromium'/u);
  assert.match(configSource, /devices\['Desktop Chrome'\]/u);
  assert.match(configSource, /desktop-production\\\.spec\\\.ts/u);
  assert.match(mainSource, /import '\.\/desktop-shell\.css';/u);
  assert.match(desktopStyles, /\.app-shell > \.bottom-nav/u);
  assert.match(desktopStyles, /position: fixed/u);
  assert.match(desktopStyles, /body > \.product-detail-fixed-action/u);
  assert.match(
    desktopStyles,
    /article\.product-detail-page \.product-detail-inline-action/u,
  );
  assert.match(desktopSpec, /product-detail-inline-action \.cta-button/u);
  assert.match(desktopSpec, /body > \.product-detail-fixed-action/u);
});
