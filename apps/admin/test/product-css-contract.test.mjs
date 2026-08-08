import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url));

test('product management and editor styles do not rely on forced overrides', () => {
  for (const fileName of ['product-management.css', 'product-editor.css']) {
    const source = fs.readFileSync(path.join(sourceDirectory, fileName), 'utf8');
    assert.doesNotMatch(
      source,
      /!important/,
      `${fileName} must not use forced overrides`,
    );
  }
});
