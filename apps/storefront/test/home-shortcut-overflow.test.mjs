import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveHomeShortcuts } from '../src/home-layout.ts';

function ids(count) {
  return Array.from({ length: count }, (_, index) => `section-${index + 1}`);
}

test('manual shortcuts do not show More just because other sections exist', () => {
  const published = new Set(ids(12));
  const result = resolveHomeShortcuts(['section-1'], ids(12), published);

  assert.deepEqual(result.sectionIds, ['section-1']);
  assert.equal(result.showMore, false);
});

test('automatic shortcuts show every section when there are eight or fewer', () => {
  const fallback = ids(8);
  const result = resolveHomeShortcuts([], fallback, new Set(fallback));

  assert.deepEqual(result.sectionIds, fallback);
  assert.equal(result.showMore, false);
});

test('automatic shortcuts reserve the eighth slot for More only after eight sections', () => {
  const fallback = ids(9);
  const result = resolveHomeShortcuts([], fallback, new Set(fallback));

  assert.deepEqual(result.sectionIds, fallback.slice(0, 7));
  assert.equal(result.showMore, true);
});
