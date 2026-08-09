import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceFiles = [
  '../src/StorefrontRoot.tsx',
  '../src/NotFoundPage.tsx',
  '../src/storefront-navigation.tsx',
  '../src/support-ui.tsx',
];

test('storefront static UI copy stays English', async () => {
  for (const sourceFile of sourceFiles) {
    const source = await readFile(new URL(sourceFile, import.meta.url), 'utf8');
    assert.doesNotMatch(
      source,
      /\p{Script=Han}/u,
      `${sourceFile} contains Han-script static UI copy`,
    );
  }
});
