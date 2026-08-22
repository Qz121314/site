import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('section filters stay compact without adding network work', async () => {
  const [section, filters, styles, main] = await Promise.all([
    readFile(new URL('../src/SectionPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/SectionFilterControls.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/section-compact-filters.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(section, /<SectionFilterControls/u);
  assert.match(section, /categories=\{query\.data\.categories\}/u);
  assert.match(section, /tags=\{query\.data\.tags\}/u);
  assert.match(section, /loadSectionSnapshot/u);

  assert.match(filters, /section-tag-filter-trigger/u);
  assert.match(filters, /aria-expanded=\{tagPanelOpen\}/u);
  assert.match(filters, /hasTags && tagPanelOpen/u);
  assert.match(filters, /section-tag-filter-count/u);
  assert.match(filters, /categories\.map/u);
  assert.match(filters, /tags\.map/u);
  assert.doesNotMatch(filters, /useQuery|fetch\(/u);

  assert.match(
    styles,
    /\.section-catalog-filters \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/u,
  );
  assert.match(styles, /\.section-category-filter \{[\s\S]*overflow-x: auto/u);
  assert.match(styles, /\.section-tag-filter-panel \{[\s\S]*max-height:/u);
  assert.match(styles, /\.section-tag-filter-panel \{[\s\S]*overflow-y: auto/u);
  assert.match(styles, /\.section-tag-filter \{[\s\S]*flex-wrap: wrap/u);

  assert.match(
    main,
    /import '\.\/catalog-polish\.css';[\s\S]*import '\.\/section-compact-filters\.css';/u,
  );
});
