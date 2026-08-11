import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateHomeLayoutInput } from '../src/settings/home-layout.ts';

const migrationSource = await readFile(
  new URL('../../../migrations/0019_home_layout.sql', import.meta.url),
  'utf8',
);
const adminRouteSource = await readFile(
  new URL('../src/routes/admin-site-settings.ts', import.meta.url),
  'utf8',
);
const publisherSource = await readFile(
  new URL('../src/publishing/modular-publisher.ts', import.meta.url),
  'utf8',
);
const workerIndexSource = await readFile(
  new URL('../src/index.ts', import.meta.url),
  'utf8',
);

test('home layout accepts at most seven shortcuts and three recommendation sections', () => {
  const result = validateHomeLayoutInput({
    shortcutSectionIds: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'],
    recommendationSectionIds: ['s1', 's3', 's5'],
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.provided, true);
});

test('home layout rejects overflow and duplicate slots', () => {
  assert.equal(
    validateHomeLayoutInput({
      shortcutSectionIds: ['1', '2', '3', '4', '5', '6', '7', '8'],
      recommendationSectionIds: [],
    }).ok,
    false,
  );
  assert.equal(
    validateHomeLayoutInput({
      shortcutSectionIds: ['one', 'one'],
      recommendationSectionIds: [],
    }).ok,
    false,
  );
  assert.equal(
    validateHomeLayoutInput({
      shortcutSectionIds: [],
      recommendationSectionIds: ['one', 'two', 'three', 'four'],
    }).ok,
    false,
  );
});

test('home layout is part of the immutable Site publication source', () => {
  assert.match(publisherSource, /getHomeLayout/u);
  assert.match(publisherSource, /homeLayout:\s*HomeLayout/u);
  assert.match(
    publisherSource,
    /sitePublicModel\(source\.site, source\.heroSlides, source\.homeLayout\)/u,
  );
  assert.match(
    publisherSource,
    /homeSectionLimit:\s*site\.home_section_limit,\s*homeLayout,/u,
  );
});

test('home layout remains Admin-edited but is not exposed through a realtime public D1 route', () => {
  assert.match(migrationSource, /placement IN \('shortcut', 'recommendation'\)/u);
  assert.match(migrationSource, /placement = 'shortcut' AND sort_order BETWEEN 0 AND 6/u);
  assert.match(
    migrationSource,
    /placement = 'recommendation' AND sort_order BETWEEN 0 AND 2/u,
  );
  assert.match(adminRouteSource, /validateHomeLayoutInput/u);
  assert.match(adminRouteSource, /getActiveHomeSectionIds/u);
  assert.doesNotMatch(workerIndexSource, /publicHomeLayoutRoutes/u);
});
