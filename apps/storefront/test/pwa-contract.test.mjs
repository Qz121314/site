import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const pwaSource = await readFile(
  new URL('../src/PwaInstallPrompt.tsx', import.meta.url),
  'utf8',
);
const systemUiSource = await readFile(
  new URL('../src/system-ui.ts', import.meta.url),
  'utf8',
);
const pwaCss = await readFile(new URL('../src/pwa.css', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('storefront declares installable app metadata', () => {
  assert.match(indexSource, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(indexSource, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(indexSource, /viewport-fit=cover/);
  assert.match(indexSource, /rel="apple-touch-icon"/);
});

test('storefront registers a root-scoped service worker and install UI', () => {
  assert.match(mainSource, /serviceWorker\s*\.register\('\/sw\.js', \{ scope: '\/' \}\)/);
  assert.match(mainSource, /<PwaInstallPrompt \/>/);
  assert.match(pwaSource, /beforeinstallprompt/);
  assert.match(pwaSource, /SYSTEM_UI\.addToHomeScreen/);
  assert.match(systemUiSource, /addToHomeScreen:\s*'Add to Home Screen'/);
});

test('install UI waits for 30 seconds of visible engagement and respects dismissal', () => {
  assert.match(pwaSource, /INSTALL_PROMPT_DELAY_MS = 30_000/);
  assert.match(pwaSource, /document\.visibilityState === 'visible'/);
  assert.match(pwaSource, /visibilitychange/);
  assert.match(pwaSource, /DISMISS_COOLDOWN_MS/);
  assert.match(pwaSource, /appinstalled/);
});

test('standalone mode uses safe areas and removes floating browser-like tab bar spacing', () => {
  assert.match(pwaCss, /@media \(display-mode: standalone\)/);
  assert.match(pwaCss, /safe-area-inset-top/);
  assert.match(pwaCss, /\.bottom-nav[\s\S]*bottom: 0/);
});

test('service worker does not cache public business APIs', () => {
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/public\/'\)/);
  assert.match(serviceWorker, /request\.mode === 'navigate'/);
});
