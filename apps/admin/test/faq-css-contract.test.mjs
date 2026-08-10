import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url));
const faqStylesheet = 'faq-management.css';

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('FAQ page styles have one authoritative owner', () => {
  const faqSource = readSource(path.join(sourceDirectory, faqStylesheet));
  assert.doesNotMatch(faqSource, /!important/);

  const faqSelectors = [
    /^\s*\.faq-search\b/m,
    /^\s*\.faq-card\b/m,
    /^\s*\.faq-card-actions\b/m,
    /^\s*\.faq-editor-form\b/m,
    /^\s*\.faq-editor-tabs\b/m,
    /^\s*\.faq-empty-state\b/m,
  ];

  const cssFiles = fs
    .readdirSync(sourceDirectory)
    .filter((fileName) => fileName.endsWith('.css'));
  for (const fileName of cssFiles) {
    if (fileName === faqStylesheet) continue;
    const cssSource = readSource(path.join(sourceDirectory, fileName));
    for (const selector of faqSelectors) {
      assert.doesNotMatch(
        cssSource,
        selector,
        `${fileName} must not redefine FAQ page selectors`,
      );
    }
  }
});
