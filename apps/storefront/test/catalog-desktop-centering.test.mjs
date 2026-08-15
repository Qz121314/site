import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('desktop section and browse catalog surfaces stay centered', () => {
  const section = source('../src/section-ui.css');
  const browse = source('../src/browse-ui.css');

  assert.match(
    section,
    /\.section-catalog-controls,\s*\.section-catalog-products\s*\{\s*margin-inline:\s*auto;/u,
  );
  assert.match(
    browse,
    /\.browse-directory-search,\s*\.browse-search-products\s*\{\s*margin-inline:\s*auto;/u,
  );
});
