import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAdminDirtySource,
  getAdminUnsavedSnapshot,
  setAdminDirtySource,
} from '../src/admin-unsaved-state.ts';

test('explicit dirty source enters and leaves the global unsaved snapshot', () => {
  const id = 'test:settings';
  clearAdminDirtySource(id);
  setAdminDirtySource(id, '站点设置', true);
  let snapshot = getAdminUnsavedSnapshot();
  assert.equal(snapshot.isDirty, true);
  assert.equal(snapshot.labels.includes('站点设置'), true);

  setAdminDirtySource(id, '站点设置', false);
  snapshot = getAdminUnsavedSnapshot();
  assert.equal(snapshot.labels.includes('站点设置'), false);
});

test('multiple explicit dirty sources are tracked independently', () => {
  const first = 'test:first';
  const second = 'test:second';
  clearAdminDirtySource(first);
  clearAdminDirtySource(second);

  setAdminDirtySource(first, '主题中心', true);
  setAdminDirtySource(second, '产品编辑', true);
  let snapshot = getAdminUnsavedSnapshot();
  assert.equal(snapshot.labels.includes('主题中心'), true);
  assert.equal(snapshot.labels.includes('产品编辑'), true);

  clearAdminDirtySource(first);
  snapshot = getAdminUnsavedSnapshot();
  assert.equal(snapshot.labels.includes('主题中心'), false);
  assert.equal(snapshot.labels.includes('产品编辑'), true);

  clearAdminDirtySource(second);
});
