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

test(
  'production smoke validates storefront boot shell separately from admin root',
  async () => {
    const workflow = await readFile(
      new URL('../../../.github/workflows/ci.yml', import.meta.url),
      'utf8',
    );

    assert.match(workflow, /assert_storefront_shell\(\)/u);
    assert.match(workflow, /grep -F 'class="boot-shell"' "\$file"/u);
    assert.match(
      workflow,
      /assert_storefront_shell \/tmp\/storefront-root\.html/u,
    );
    assert.match(
      workflow,
      /assert_storefront_shell \/tmp\/storefront-not-found\.body/u,
    );
    assert.match(
      workflow,
      /grep -F '<div id="root"><\/div>' \/tmp\/admin-root\.html/u,
    );
    assert.doesNotMatch(workflow, /for path in \/ \/admin\/; do/u);
  },
);
