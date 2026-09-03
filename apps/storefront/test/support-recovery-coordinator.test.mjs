import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupportRecoveryCoordinator } from '../src/support-recovery-coordinator.ts';

test('storefront recovery coalesces concurrent signals and runs one trailing cycle', async () => {
  const calls = [];
  const resolvers = [];
  const coordinator = createSupportRecoveryCoordinator(() => {
    calls.push(calls.length + 1);
    return new Promise((resolve) => resolvers.push(resolve));
  });

  const first = coordinator.recover();
  const second = coordinator.recover();
  const third = coordinator.recover();
  assert.strictEqual(first, second);
  assert.strictEqual(second, third);
  assert.deepEqual(calls, [1]);

  resolvers.shift()();
  await Promise.resolve();
  assert.deepEqual(calls, [1, 2]);
  resolvers.shift()();
  await first;

  const later = coordinator.recover();
  assert.notStrictEqual(later, first);
  assert.deepEqual(calls, [1, 2, 3]);
  resolvers.shift()();
  await later;
});
