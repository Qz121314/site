import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateHomeLayoutInput } from '../src/settings/home-layout.ts';

test('Home recommendation sections are not capped at three', () => {
  const result = validateHomeLayoutInput({
    shortcutSectionIds: [],
    recommendationSectionIds: ['a', 'b', 'c', 'd'],
  });

  assert.equal(result.ok, true);
  if (!result.ok || !result.provided) return;
  assert.equal(result.value.recommendationSectionIds.length, 4);
});

test('Home shortcut sections keep their seven-item cap', () => {
  const result = validateHomeLayoutInput({
    shortcutSectionIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    recommendationSectionIds: [],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.field, 'homeLayout.shortcutSectionIds');
});

test('D1 schema permits recommendation slots beyond three', () => {
  const migrationPath = '../../../migrations/0030_expand_home_recommendation_slots.sql';
  const migration = readFileSync(new URL(migrationPath, import.meta.url), 'utf8');
  const shortcutRule = "placement = 'shortcut' AND sort_order BETWEEN 0 AND 6";
  const recommendationRule = "placement = 'recommendation' AND sort_order >= 0";
  const oldRule = "placement = 'recommendation' AND sort_order BETWEEN 0 AND 2";

  assert.ok(migration.includes(shortcutRule));
  assert.ok(migration.includes(recommendationRule));
  assert.ok(!migration.includes(oldRule));
});
