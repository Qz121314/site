import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('FAQ query is disabled when the published navigation hides FAQ', () => {
  const faqSection = appSource.match(/function FaqSection[\s\S]*?function HomePage/)?.[0] ?? '';
  assert.match(faqSection, /queryFn:\s*\(\{ signal \}\) => loadFaqSnapshot\(bootstrap, signal\)/);
  assert.match(faqSection, /enabled:\s*bootstrap\.site\.site\.navigation\.showFaq/);
  assert.match(faqSection, /if \(!bootstrap\.site\.site\.navigation\.showFaq\) return null/);
});
