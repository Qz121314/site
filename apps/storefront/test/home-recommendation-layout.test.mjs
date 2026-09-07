import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHomeLayout } from '../src/content.ts';
import { resolveHomeLayout } from '../src/home-layout.ts';

const recommendationIds = ['a', 'b', 'c', 'd', 'e'];
const publishedSectionIds = new Set([...recommendationIds, 'f', 'g', 'h']);

test('published Home layout preserves recommendation sections beyond three', () => {
  const normalized = normalizeHomeLayout({
    shortcutSectionIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    recommendationSectionIds: recommendationIds,
  });

  assert.deepEqual(normalized.shortcutSectionIds, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.deepEqual(normalized.recommendationSectionIds, recommendationIds);

  const resolved = resolveHomeLayout(
    normalized,
    { shortcutSectionIds: [], recommendationSectionIds: [] },
    publishedSectionIds,
  );

  assert.deepEqual(resolved.recommendationSectionIds, recommendationIds);
});
