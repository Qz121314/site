import assert from 'node:assert/strict';
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
