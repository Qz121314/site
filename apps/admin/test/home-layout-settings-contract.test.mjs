import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/HomeLayoutSettingsSection.tsx', import.meta.url),
  'utf8',
);
const api = readFileSync(
  new URL('../src/site-hero-settings-api.ts', import.meta.url),
  'utf8',
);

test('Home layout owns only selected section placement and ordering', () => {
  assert.match(source, /recommendationSectionIds: null/u);
  assert.match(source, /limit === null \? `\$\{ids\.length\} 个`/u);
  assert.doesNotMatch(source, /推荐分区'[\s\S]*最多 3 个/u);
  assert.match(source, /draggable=\{!busy\}/u);
  assert.match(source, /onDrop=/u);
  assert.match(source, /添加快捷分区/u);
  assert.match(source, /添加推荐分区/u);
  assert.doesNotMatch(source, /homeSectionLimit|商品展示数量/u);
  assert.match(
    api,
    /recommendationSectionIds: parseSectionIds\(value\.recommendationSectionIds\)/u,
  );
});
