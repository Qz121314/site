import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  filterHomeLayoutByPublishedSections,
  validateHomeLayoutInput,
} from '../src/settings/home-layout.ts';

const migrationSource = await readFile(
  new URL('../../../migrations/0019_home_layout.sql', import.meta.url),
  'utf8',
);
const publicRouteSource = await readFile(
  new URL('../src/routes/public-home-layout.ts', import.meta.url),
  'utf8',
);
const adminRouteSource = await readFile(
  new URL('../src/routes/admin-site-settings.ts', import.meta.url),
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

test('public home layout only exposes sections present in the published pointer', () => {
  const filtered = filterHomeLayoutByPublishedSections(
    {
      shortcutSectionIds: ['s1', 'draft', 's2'],
      recommendationSectionIds: ['draft', 's2', 's3'],
    },
    new Set(['s1', 's2']),
  );
  assert.deepEqual(filtered, {
    shortcutSectionIds: ['s1', 's2'],
    recommendationSectionIds: ['s2'],
  });
});

test('home layout persists fixed placement bounds and is bound to the published pointer', () => {
  assert.match(migrationSource, /placement IN \('shortcut', 'recommendation'\)/u);
  assert.match(migrationSource, /placement = 'shortcut' AND sort_order BETWEEN 0 AND 6/u);
  assert.match(
    migrationSource,
    /placement = 'recommendation' AND sort_order BETWEEN 0 AND 2/u,
  );
  assert.match(publicRouteSource, /max-age=30/u);
  assert.match(publicRouteSource, /readModularPointer/u);
  assert.match(publicRouteSource, /pointerVersion:\s*pointer\.contentVersion/u);
  assert.match(publicRouteSource, /filterHomeLayoutByPublishedSections/u);
  assert.match(adminRouteSource, /validateHomeLayoutInput/u);
  assert.match(adminRouteSource, /getActiveHomeSectionIds/u);
});
