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
