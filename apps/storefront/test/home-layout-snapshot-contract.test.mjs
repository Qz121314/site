import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contentSource = await readFile(
  new URL('../src/content.ts', import.meta.url),
  'utf8',
);
const feedSource = await readFile(
  new URL('../src/HomeFeed.tsx', import.meta.url),
  'utf8',
);
const layoutSource = await readFile(
  new URL('../src/home-layout.ts', import.meta.url),
  'utf8',
);

test('schema-v2 Site snapshots carry Home Layout into Storefront bootstrap', () => {
  assert.match(contentSource, /homeLayout\?: HomeLayout/u);
  assert.match(
    contentSource,
    /homeLayout:\s*normalizeHomeLayout\(rawSite\.site\.homeLayout\)/u,
  );
  assert.match(feedSource, /resolveHomeLayout\(site\.homeLayout,/u);
});

test('Home Layout resolution is pure published-state logic with no runtime API fetch', () => {
  assert.doesNotMatch(layoutSource, /fetch\(/u);
  assert.doesNotMatch(feedSource, /loadHomeLayout/u);
  assert.match(layoutSource, /publishedSectionIds/u);
});
