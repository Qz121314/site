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

test('Home recommendations have no fixed item cap in the admin', () => {
  assert.match(source, /recommendationSectionIds: null/u);
  assert.match(source, /limit === null \? `\$\{ids\.length\} 个`/u);
  assert.doesNotMatch(source, /推荐分区'[\s\S]*最多 3 个/u);
  assert.match(
    api,
    /recommendationSectionIds: parseSectionIds\(value\.recommendationSectionIds\)/u,
  );
});
