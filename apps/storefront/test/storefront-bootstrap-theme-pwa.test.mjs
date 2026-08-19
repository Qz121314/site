import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Storefront startup reuses bootstrap for live theme and PWA runtime data', async () => {
  const [mainSource, rootSource, pwaSource, contentSource] = await Promise.all([
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/PwaInstallPrompt.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/content.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(mainSource, /installCachedStorefrontTheme\(\)/u);
  assert.doesNotMatch(mainSource, /installStorefrontTheme\(\)/u);
  assert.match(rootSource, /applyStorefrontTheme\(bootstrap\.theme\)/u);
  assert.match(rootSource, /publishPwaInstallRuntime/u);
  assert.equal(pwaSource.includes("fetch('/manifest.webmanifest"), false);
  assert.equal(pwaSource.includes('fetch("/manifest.webmanifest'), false);
  assert.match(pwaSource, /beforeinstallprompt/u);
  assert.match(contentSource, /loadTheme\(signal\)/u);
});
