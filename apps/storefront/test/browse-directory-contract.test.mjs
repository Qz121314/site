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
const adminEditor = await readFile(
  new URL('../../admin/src/section-management/SectionEditorDialog.tsx', import.meta.url),
  'utf8',
);
const publicRoute = await readFile(
  new URL('../../worker/src/routes/public-browse-sections.ts', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../../../migrations/0020_section_browse_presentation.sql', import.meta.url),
  'utf8',
);

test('Browse starts with search and only renders backend-provided section artwork', () => {
  assert.match(browsePage, /browse-section-card-background/u);
  assert.match(
    browsePage,
    /presentation\?\.backgroundUrl \? \([\s\S]*?browse-section-card-background[\s\S]*?<ResilientImage/u,
  );
  assert.match(browsePage, /presentation\?\.description/u);
  assert.match(browsePage, /presentation\.productCount > 0/u);
  assert.doesNotMatch(browsePage, /SectionIcon/u);
  assert.doesNotMatch(browsePage, /section-icon/u);
  assert.doesNotMatch(
    browsePage,
    /browse-directory-heading|browse-section-card-fallback/u,
  );
  assert.doesNotMatch(browsePage, /<h2 id="browse-directory-sections-title"/u);
  assert.match(browseCss, /\.browse-section-list/u);
  assert.match(browseCss, /\.browse-section-card-overlay/u);
  assert.match(browseCss, /\.browse-section-card:not\(\.has-image\)/u);
  assert.doesNotMatch(browseCss, /\.browse-section-card-fallback/u);
});

test('Browse section directory is one column on mobile and two columns on desktop', () => {
  assert.match(
    browseCss,
    /\.browse-section-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su,
  );
  assert.match(
    browseCss,
    /@media \(min-width:\s*768px\)[\s\S]*?\.browse-section-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u,
  );
});

test('Home icon and Browse background remain separate section presentation fields', () => {
  assert.match(adminEditor, />分区快捷图标</u);
  assert.match(adminEditor, />Browse 分区背景图</u);
  assert.match(adminEditor, /只用于 Browse 的详细分区卡片/u);
  assert.match(migration, /browse_background_asset_id/u);
  assert.match(migration, /description TEXT/u);
});

test('Browse presentation counts only published products and exposes no icon field', () => {
  assert.match(publicRoute, /p\.status = 'published'/u);
  assert.match(publicRoute, /backgroundUrl/u);
  assert.match(publicRoute, /productCount/u);
  assert.doesNotMatch(publicRoute, /iconUrl|iconValue|icon_type/u);
});
