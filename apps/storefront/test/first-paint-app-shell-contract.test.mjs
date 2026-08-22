import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the initial HTML paint presents app-shell chrome before React starts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /class="boot-shell" aria-hidden="true"/u);
  assert.match(html, /class="boot-app-bar"/u);
  assert.match(html, /class="boot-hero"/u);
  assert.match(html, /class="boot-shortcuts"/u);
  assert.match(html, /class="boot-product-grid"/u);
  assert.match(html, /class="boot-bottom-nav"/u);
  assert.match(
    html,
    /--boot-header-height: calc\(58px \+ env\(safe-area-inset-top\)\);/u,
  );
  assert.match(
    html,
    /--boot-bottom-height: calc\(66px \+ env\(safe-area-inset-bottom\)\);/u,
  );
  assert.match(html, /\.boot-shell \{[\s\S]*?min-height: 100dvh;/u);
  assert.match(html, /\.boot-app-bar \{[\s\S]*?position: fixed;/u);
  assert.match(html, /\.boot-bottom-nav \{[\s\S]*?position: fixed;/u);
  assert.match(html, /@media \(min-width: 980px\)[\s\S]*?\.boot-bottom-nav/u);
});

test('production smoke separates storefront and admin roots', async () => {
  const workflowUrl = new URL('../../../.github/workflows/ci.yml', import.meta.url);
  const source = await readFile(workflowUrl, 'utf8');
  const has = (fragment) => source.includes(fragment);

  assert.ok(has('assert_storefront_shell()'));
  assert.ok(has('class="boot-shell"'));
  assert.ok(has('assert_storefront_shell /tmp/storefront-root.html'));
  assert.ok(has('assert_storefront_shell /tmp/storefront-not-found.body'));
  assert.ok(has('/tmp/admin-root.html'));
  assert.ok(has('<div id="root"></div>'));
  assert.ok(!has('for path in / /admin/; do'));
});
