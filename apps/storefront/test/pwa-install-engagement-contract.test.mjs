import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('PWA install prompt waits for browsing intent and stays session-bounded', async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL('../src/PwaInstallPrompt.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pwa.css', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /SESSION_PROMPTED_KEY/u);
  assert.match(source, /ENGAGEMENT_SCROLL_PX/u);
  assert.match(source, /ENGAGEMENT_ROUTE_COUNT/u);
  assert.match(source, /routeSignalsStrongIntent/u);
  assert.match(source, /window\.addEventListener\(NAVIGATION_EVENT/u);
  assert.match(source, /document\.addEventListener\('scroll'/u);
  assert.match(source, /delayComplete\s*&&\s*engaged/u);
  assert.match(source, /markSessionPrompted\(\)/u);
  assert.match(styles, /\.pwa-install-card\.is-guidance/u);
  assert.match(styles, /border-radius: var\(--theme-radius-card/u);
  assert.doesNotMatch(styles, /border-radius: max\(var\(--theme-radius-card/u);
});
