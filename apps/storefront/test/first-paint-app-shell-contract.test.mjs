import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the initial HTML paint presents app-shell chrome before React starts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /<div id="root"><\/div>/u);
  assert.match(
    html,
    /--boot-header-height: calc\(58px \+ env\(safe-area-inset-top\)\);/u,
  );
  assert.match(
    html,
    /--boot-bottom-height: calc\(66px \+ env\(safe-area-inset-bottom\)\);/u,
  );
  assert.match(html, /#root:empty \{[\s\S]*?min-height: 100dvh;/u);
  assert.match(html, /#root:empty::before \{[\s\S]*?position: fixed;/u);
  assert.match(html, /#root:empty::after \{[\s\S]*?position: fixed;/u);
  assert.match(html, /@media \(min-width: 980px\)[\s\S]*?#root:empty::after/u);
});
