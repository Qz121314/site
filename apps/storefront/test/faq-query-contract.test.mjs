import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const faqSource = await readFile(new URL('../src/FaqPage.tsx', import.meta.url), 'utf8');
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);

test('FAQ query remains available for the dedicated fixed navigation page', () => {
  assert.match(
    faqSource,
    /queryFn:\s*\(\{ signal \}\) => loadFaqSnapshot\(bootstrap, signal\)/,
  );
  assert.doesNotMatch(faqSource, /enabled:\s*bootstrap\.site\.site\.navigation\.showFaq/);
  assert.doesNotMatch(
    faqSource,
    /if \(!bootstrap\.site\.site\.navigation\.showFaq\) return null/,
  );
  assert.match(rootSource, /case 'faq':[\s\S]*?page = \([\s\S]*?<FaqDirectoryPage/);
  assert.match(rootSource, /<PrimaryShell[\s\S]*activePath=\{pathname\}/);
});
