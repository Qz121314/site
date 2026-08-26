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

test('D1 schema keeps shortcut cap but allows recommendation slots beyond three', () => {
  const migration = readFileSync(
    new URL('../../../migrations/0030_expand_home_recommendation_slots.sql', import.meta.url),
    'utf8',
  );

  assert.match(migration, /placement = 'shortcut' AND sort_order BETWEEN 0 AND 6/u);
  assert.match(migration, /placement = 'recommendation' AND sort_order >= 0/u);
  assert.doesNotMatch(
    migration,
    /placement = 'recommendation' AND sort_order BETWEEN 0 AND 2/u,
  );
});
