import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('section filters use already-loaded section data without adding network work', async () => {
  const [section, filters] = await Promise.all([
    readFile(new URL('../src/SectionPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/SectionFilterControls.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(section, /<SectionFilterControls/u);
  assert.match(section, /categories=\{query\.data\.categories\}/u);
  assert.match(section, /tags=\{query\.data\.tags\}/u);
  assert.match(section, /loadSectionSnapshot/u);

  assert.match(filters, /aria-expanded=\{tagPanelOpen\}/u);
  assert.match(filters, /categories\.map/u);
  assert.match(filters, /tags\.map/u);
  assert.doesNotMatch(filters, /useQuery|fetch\(/u);
});
