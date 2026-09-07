import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMediaPickerSelection } from '../src/asset-library/media-picker-selection.ts';

function asset(overrides = {}) {
  return {
    id: 'media-1',
    objectKey: 'media/media-1.webp',
    fileName: 'media-1.webp',
    mimeType: 'image/webp',
    byteSize: 1234,
    mediaKind: 'image',
    width: 1200,
    height: 800,
    durationMs: null,
    folderId: null,
    folderName: null,
    roles: [],
    publicUrl: null,
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}

test('normal media picker selection preserves role-assignment behavior', async () => {
  const calls = [];
  const selected = await prepareMediaPickerSelection(
    asset(),
    { mode: 'assign-role', role: 'background' },
    async (assetId, role) => calls.push([assetId, role]),
  );

  assert.deepEqual(calls, [['media-1', 'background']]);
  assert.deepEqual(selected.roles, ['background']);
});

test('normal media picker selection skips duplicate role assignment', async () => {
  const calls = [];
  const original = asset({ roles: ['background'] });
  const selected = await prepareMediaPickerSelection(
    original,
    { mode: 'assign-role', role: 'background' },
    async (assetId, role) => calls.push([assetId, role]),
  );

  assert.deepEqual(calls, []);
  assert.equal(selected, original);
});

// Regression guard: weak placement references must never mutate MediaRole ownership.
test('reference-only media picker selection never calls assignMediaRole equivalent', async () => {
  let called = false;
  const original = asset({ roles: ['general'] });
  const selected = await prepareMediaPickerSelection(
    original,
    { mode: 'reference-only' },
    async () => {
      called = true;
      throw new Error('reference-only must not assign a role');
    },
  );

  assert.equal(called, false);
  assert.equal(selected, original);
  assert.deepEqual(selected.roles, ['general']);
});
