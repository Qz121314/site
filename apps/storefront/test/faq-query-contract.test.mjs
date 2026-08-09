import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('FAQ query remains available for the dedicated fixed navigation page', () => {
  const faqSection = appSource.match(/function FaqSection[\s\S]*?function HomePage/)?.[0] ?? '';
  assert.match(faqSection, /queryFn:\s*\(\{ signal \}\) => loadFaqSnapshot\(bootstrap, signal\)/);
  assert.doesNotMatch(faqSection, /enabled:\s*bootstrap\.site\.site\.navigation\.showFaq/);
  assert.doesNotMatch(faqSection, /if \(!bootstrap\.site\.site\.navigation\.showFaq\) return null/);
  assert.match(
    appSource,
    /case 'faq':\s*page = <FaqPage bootstrap=\{bootstrapQuery\.data\} \/>;\s*break;/,
  );
  assert.match(
    appSource,
    /<StorefrontCopyProvider value=\{copyQuery\.data \?\? FALLBACK_STOREFRONT_COPY\}>[\s\S]*?\{page\}[\s\S]*?<\/StorefrontCopyProvider>/,
  );
});
