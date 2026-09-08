import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const modularPublisherUrl = new URL(
  '../src/publishing/modular-publisher.ts',
  import.meta.url,
);
const storefrontPublisherUrl = new URL(
  '../src/publishing/storefront-publisher.ts',
  import.meta.url,
);
const bootstrapSnapshotUrl = new URL(
  '../src/publishing/storefront-bootstrap-snapshot.ts',
  import.meta.url,
);
const bootstrapProtocolUrl = new URL(
  '../src/publishing/storefront-bootstrap-protocol.json',
  import.meta.url,
);

test('publish and rollback materialize bootstrap artifacts before committing the public pointer', async () => {
  const [modularPublisher, storefrontPublisher] = await Promise.all([
    readFile(modularPublisherUrl, 'utf8'),
    readFile(storefrontPublisherUrl, 'utf8'),
  ]);

  const pointerCommits = [
    ...modularPublisher.matchAll(
      /await beforePointerCommit\?\.\(nextPointer\);\s*await bucket\.put\(CURRENT_KEY, JSON\.stringify\(nextPointer\)/gu,
    ),
  ];
  assert.equal(
    pointerCommits.length,
    2,
    'publish and rollback must each gate the pointer commit',
  );

  const bootstrapMaterialization = storefrontPublisher.indexOf(
    'await materializeDerivedSnapshots(bucket, pointer);',
  );
  const bootstrapWrite = storefrontPublisher.indexOf(
    'await writeStorefrontPublishedBootstrap(bucket, pointer);',
  );
  assert.ok(bootstrapMaterialization >= 0);
  assert.ok(bootstrapWrite > bootstrapMaterialization);
  assert.match(
    storefrontPublisher,
    /publishCore\([\s\S]*?\(pointer\) =>\s*refreshPublishedBootstrap\(bucket, pointer\)/u,
  );
  assert.match(
    storefrontPublisher,
    /rollbackCore\([\s\S]*?\(pointer\) => refreshPublishedBootstrap\(bucket, pointer\)/u,
  );
});

test('publisher writes the repository-owned current bootstrap protocol', async () => {
  const [bootstrapSnapshot, protocolBody] = await Promise.all([
    readFile(bootstrapSnapshotUrl, 'utf8'),
    readFile(bootstrapProtocolUrl, 'utf8'),
  ]);
  const protocol = JSON.parse(protocolBody);

  assert.equal(protocol.currentSchemaVersion, 4);
  assert.equal(protocol.minReadableSchemaVersion, 4);
  assert.ok(protocol.currentSchemaVersion - protocol.minReadableSchemaVersion <= 1);
  assert.match(
    bootstrapSnapshot,
    /schemaVersion:\s*STOREFRONT_BOOTSTRAP_SCHEMA_CURRENT/u,
  );
  assert.match(
    bootstrapSnapshot,
    /protocol:\s*storefrontBootstrapProtocolDescriptor\(\)/u,
  );
  assert.doesNotMatch(bootstrapSnapshot, /const BOOTSTRAP_SCHEMA_VERSION\s*=/u);
});
