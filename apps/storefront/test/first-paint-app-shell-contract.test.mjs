import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the initial HTML paint presents persistent app-shell chrome before React starts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /class="boot-shell" aria-hidden="true"/u);
  assert.match(html, /class="boot-app-bar"/u);
  assert.doesNotMatch(
    html,
    /rel="preload"[\s\S]*?as="fetch"[\s\S]*?\/api\/public\/storefront\/bootstrap/u,
  );
  assert.match(html, /\.boot-app-bar \{[\s\S]*?position: fixed;/u);
  assert.doesNotMatch(html, /boot-(hero|shortcuts|section-heading|product-grid)/u);
});

test('startup loading surface does not invent homepage content before bootstrap data arrives', async () => {
  const source = await readFile(
    new URL('../src/LoadingStates.tsx', import.meta.url),
    'utf8',
  );
  const startupLoader = source.slice(0, source.indexOf('export function RouteProgress'));

  assert.doesNotMatch(
    startupLoader,
    /startup-(hero|shortcuts|section-heading|product-rail)/u,
  );
  assert.doesNotMatch(startupLoader, /Array\.from\(\{ length:/u);
  assert.match(startupLoader, /startup-action-skeletons/u);
  assert.match(startupLoader, /startup-bottom-nav-skeleton/u);
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
