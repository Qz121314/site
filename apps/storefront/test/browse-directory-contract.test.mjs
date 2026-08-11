import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const browsePage = await readFile(
  new URL('../src/BrowsePage.tsx', import.meta.url),
  'utf8',
);
const browseCss = await readFile(
  new URL('../src/browse-ui.css', import.meta.url),
  'utf8',
);
const contentSource = await readFile(
  new URL('../src/content.ts', import.meta.url),
  'utf8',
);
const workerIndex = await readFile(
  new URL('../../worker/src/index.ts', import.meta.url),
  'utf8',
);
const adminEditor = await readFile(
  new URL('../../admin/src/section-management/SectionEditorDialog.tsx', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../../../migrations/0020_section_browse_presentation.sql', import.meta.url),
  'utf8',
);

test('Browse uses section background artwork as the visual card surface', () => {
  assert.match(browsePage, /browse-section-card-media/u);
  assert.match(browsePage, /section\.browseBackgroundUrl/u);
  assert.match(browsePage, /src=\{section\.browseBackgroundUrl\}/u);
  assert.match(browsePage, /section\.description/u);
  assert.match(browsePage, /browse-section-card-scrim/u);
  assert.doesNotMatch(browsePage, /sectionInitial\(section\.name\)/u);
  assert.doesNotMatch(browsePage, /browse-section-card-chevron/u);
  assert.doesNotMatch(browsePage, /SectionIcon|section-icon/u);
  assert.doesNotMatch(browsePage, /browse-directory-heading/u);
  assert.doesNotMatch(browsePage, /<h2 id="browse-directory-sections-title"/u);
  assert.match(browseCss, /\.browse-section-card-media/u);
  assert.match(browseCss, /\.browse-section-card-scrim/u);
  assert.match(browseCss, /object-fit:\s*cover/u);
  assert.doesNotMatch(browseCss, /browse-section-card-chevron/u);
});

test('Browse uses one hero card for one section and a discovery grid for multiple sections', () => {
  assert.match(browsePage, /filteredSections\.length === 1 \? ' is-single' : ''/u);
  assert.match(
    browseCss,
    /\.browse-section-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/su,
  );
  assert.match(
    browseCss,
    /\.browse-section-list\.is-single\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su,
  );
  assert.match(
    browseCss,
    /\.browse-section-list\.is-single \.browse-section-card\s*\{[^}]*aspect-ratio:\s*16 \/ 9/su,
  );
  assert.match(
    browseCss,
    /@media \(min-width:\s*768px\)[\s\S]*?\.browse-section-list\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/u,
  );
});

test('Home icon and Browse background remain separate section presentation fields', () => {
  assert.match(adminEditor, />分区快捷图标</u);
  assert.match(adminEditor, /只用于 Home 的快捷分区入口；Browse 页面不会使用这个图标/u);
  assert.match(adminEditor, />Browse 分区背景图</u);
  assert.match(
    adminEditor,
    /只用于 Browse 页面分区视觉卡，不影响 Home 快捷图标和产品封面/u,
  );
  assert.match(migration, /browse_background_asset_id/u);
  assert.match(migration, /description TEXT/u);
});

test('Browse presentation is part of the published Section contract with no second API', () => {
  assert.match(contentSource, /description\?: string \| null/u);
  assert.match(contentSource, /browseBackgroundObjectKey\?: string \| null/u);
  assert.match(contentSource, /browseBackgroundUrl: mediaUrl/u);
  assert.doesNotMatch(
    browsePage,
    /loadBrowseSectionPresentations|presentationQuery|presentationById/u,
  );
  assert.doesNotMatch(workerIndex, /publicBrowseSectionRoutes|\/api\/public\/browse-sections/u);
});
