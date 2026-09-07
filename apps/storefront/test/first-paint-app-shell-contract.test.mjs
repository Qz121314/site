import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the initial HTML paint presents persistent app-shell chrome before React starts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /class="boot-shell" aria-hidden="true"/u);
  assert.match(html, /class="boot-app-bar"/u);
  assert.match(html, /class="boot-bottom-nav"/u);
  assert.match(html, /\.boot-app-bar \{[\s\S]*?position: fixed;/u);
  assert.match(html, /\.boot-bottom-nav \{[\s\S]*?position: fixed;/u);
});

test('minimal production smoke validates the Storefront app shell', async () => {
  const source = await readFile(
    new URL('../../../scripts/production-smoke.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /fetchRequired\('\/'\)/u);
  assert.match(source, /class="boot-shell"/u);
  assert.match(source, /<div id="root">/u);
  assert.match(source, /Worker version confirmed/u);
});
