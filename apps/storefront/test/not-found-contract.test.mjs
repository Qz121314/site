import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const notFoundSource = await readFile(
  new URL('../src/NotFoundPage.tsx', import.meta.url),
  'utf8',
);

test('unknown and invalid routes use the primary shell and the small 404 page', () => {
  assert.match(rootSource, /const route = parseStorefrontRoute\(pathname\)/u);
  assert.match(rootSource, /default:[\s\S]*?<NotFoundPage/u);
  assert.match(rootSource, /<PrimaryShell[\s\S]*activePath=\{pathname\}/u);
  assert.match(rootSource, /<NotFoundPage/u);
  assert.match(notFoundSource, /<div className="state-mark">404<\/div>/u);
  assert.match(
    notFoundSource,
    /<LinkComponent className="primary-button" href="\/">\s*Back to home\s*<\/LinkComponent>/u,
  );
});
