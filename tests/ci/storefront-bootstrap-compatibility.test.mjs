import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPublishedBootstrapCompatible,
  bootstrapObjectKey,
  loadBootstrapProtocolConfig,
  parsePublishedBootstrap,
  parsePublishedPointer,
  runPublishedBootstrapCompatibilityCheck,
  validateBootstrapProtocolConfig,
} from '../../scripts/check-storefront-bootstrap-compatibility.mjs';

test('repository bootstrap protocol keeps a bounded readable window', () => {
  const protocol = loadBootstrapProtocolConfig();
  assert.equal(protocol.currentSchemaVersion, 4);
  assert.equal(protocol.minReadableSchemaVersion, 4);
  assert.ok(protocol.currentSchemaVersion - protocol.minReadableSchemaVersion <= 1);
});

test('protocol supports an N/N-1 rolling window without unbounded legacy support', () => {
  const protocol = validateBootstrapProtocolConfig({
    currentSchemaVersion: 5,
    minReadableSchemaVersion: 4,
    capabilities: ['runtime'],
  });
  assert.doesNotThrow(() =>
    assertPublishedBootstrapCompatible(protocol, { schemaVersion: 4 }),
  );
  assert.doesNotThrow(() =>
    assertPublishedBootstrapCompatible(protocol, { schemaVersion: 5 }),
  );
  assert.throws(
    () => assertPublishedBootstrapCompatible(protocol, { schemaVersion: 3 }),
    /incompatible with runtime readable range 4\.\.5/u,
  );
  assert.throws(
    () => assertPublishedBootstrapCompatible(protocol, { schemaVersion: 6 }),
    /incompatible with runtime readable range 4\.\.5/u,
  );
});

test('protocol rejects compatibility windows wider than N/N-1', () => {
  assert.throws(
    () =>
      validateBootstrapProtocolConfig({
        currentSchemaVersion: 6,
        minReadableSchemaVersion: 4,
        capabilities: [],
      }),
    /bounded to N\/N-1/u,
  );
});

test('old production publication is blocked before deployment when runtime cannot read it', () => {
  const protocol = loadBootstrapProtocolConfig();
  assert.throws(
    () => assertPublishedBootstrapCompatible(protocol, { schemaVersion: 3 }),
    /Production bootstrap schema 3 is incompatible/u,
  );
});

test('production gate resolves the current pointer then checks exactly one versioned bootstrap artifact', () => {
  const pointer = {
    schemaVersion: 2,
    contentVersion: '20260908143000-pointer-rollout01',
  };
  const reads = [];
  const result = runPublishedBootstrapCompatibilityCheck({
    bucketName: 'test-bucket',
    readRemoteJson(bucketName, key) {
      reads.push({ bucketName, key });
      if (key === 'public/current.json') return pointer;
      if (key === bootstrapObjectKey(pointer)) {
        return {
          schemaVersion: 4,
          protocol: {
            schemaVersion: 4,
            minReadableSchemaVersion: 4,
            capabilities: ['published-runtime-config'],
          },
        };
      }
      throw new Error(`unexpected key ${key}`);
    },
  });
  assert.deepEqual(result, { schemaVersion: 4, readableRange: '4..4' });
  assert.deepEqual(reads, [
    { bucketName: 'test-bucket', key: 'public/current.json' },
    {
      bucketName: 'test-bucket',
      key: 'public/bootstrap/20260908143000-pointer-rollout01/bootstrap.json',
    },
  ]);
});

test('pointer and bootstrap protocol metadata are validated before compatibility comparison', () => {
  assert.deepEqual(
    parsePublishedPointer({
      schemaVersion: 2,
      contentVersion: '20260908143000-pointer-rollout01',
    }),
    { contentVersion: '20260908143000-pointer-rollout01' },
  );
  assert.deepEqual(parsePublishedBootstrap({ schemaVersion: 4 }), { schemaVersion: 4 });
  assert.throws(
    () =>
      parsePublishedBootstrap({
        schemaVersion: 4,
        protocol: { schemaVersion: 3 },
      }),
    /protocol metadata is inconsistent/u,
  );
});
