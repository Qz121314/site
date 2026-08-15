from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

for relative, selectors in {
    'apps/storefront/src/section-ui.css': [
        '.section-catalog-controls',
        '.section-catalog-products',
    ],
    'apps/storefront/src/browse-ui.css': [
        '.browse-directory-search',
        '.browse-search-products',
    ],
}.items():
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    block = '\n\n/* Keep narrow desktop catalog surfaces optically centered inside the app shell. */\n' + ',\n'.join(selectors) + ' {\n  margin-inline: auto;\n}\n'
    if block.strip() not in text:
        path.write_text(text + block, encoding='utf-8')

(ROOT / 'apps/storefront/test/catalog-desktop-centering.test.mjs').write_text(
    """import assert from 'node:assert/strict';
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
""",
    encoding='utf-8',
)

print('Catalog desktop centering applied.')
