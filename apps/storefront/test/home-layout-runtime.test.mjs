import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveHomeLayout } from '../src/home-layout.ts';

test('empty Home layout automatically falls back to published sections and recommendations', () => {
  const resolved = resolveHomeLayout(
    { shortcutSectionIds: [], recommendationSectionIds: [] },
    {
      shortcutSectionIds: ['s1', 's2'],
      recommendationSectionIds: ['s2', 's1'],
    },
    new Set(['s1', 's2']),
  );

  assert.deepEqual(resolved, {
    shortcutSectionIds: ['s1', 's2'],
    recommendationSectionIds: ['s2', 's1'],
  });
});

test('configured Home layout keeps valid operator order', () => {
  const resolved = resolveHomeLayout(
    {
      shortcutSectionIds: ['s2', 's1'],
      recommendationSectionIds: ['s1'],
    },
    {
      shortcutSectionIds: ['s1', 's2'],
      recommendationSectionIds: ['s2'],
    },
    new Set(['s1', 's2']),
  );

  assert.deepEqual(resolved, {
    shortcutSectionIds: ['s2', 's1'],
    recommendationSectionIds: ['s1'],
  });
});

test('Home layout falls back when every configured section is outside the published pointer', () => {
  const resolved = resolveHomeLayout(
    {
      shortcutSectionIds: ['draft'],
      recommendationSectionIds: ['draft'],
    },
    {
      shortcutSectionIds: ['s1'],
      recommendationSectionIds: ['s1'],
    },
    new Set(['s1']),
  );

  assert.deepEqual(resolved, {
    shortcutSectionIds: ['s1'],
    recommendationSectionIds: ['s1'],
  });
});
