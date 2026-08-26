import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHomeLayoutInput } from '../src/settings/home-layout.ts';

test('Home recommendation sections are not capped at three', () => {
  const recommendationSectionIds = Array.from({ length: 12 }, (_, index) => `section-${index + 1}`);
  const result = validateHomeLayoutInput({
    shortcutSectionIds: [],
    recommendationSectionIds,
  });

  assert.equal(result.ok, true);
  if (!result.ok || !result.provided) return;
  assert.deepEqual(result.value.recommendationSectionIds, recommendationSectionIds);
});

test('Home shortcut sections keep their seven-item cap', () => {
  const result = validateHomeLayoutInput({
    shortcutSectionIds: Array.from({ length: 8 }, (_, index) => `shortcut-${index + 1}`),
    recommendationSectionIds: [],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.field, 'homeLayout.shortcutSectionIds');
});
