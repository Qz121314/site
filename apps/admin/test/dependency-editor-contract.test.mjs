import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url));

function readSource(relativePath) {
  return fs.readFileSync(path.join(sourceDirectory, relativePath), 'utf8');
}

test('dependency editor failures remain visible inside open dialogs', () => {
  for (const relativePath of [
    'category-management/CategoryEditorDialog.tsx',
    'conversion-pool/ConversionGroupEditorDialog.tsx',
    'conversion-pool/ConversionTargetEditorDialog.tsx',
    'TagManagementView.tsx',
  ]) {
    const source = readSource(relativePath);
    assert.match(source, /errorMessage/);
    assert.match(source, /className="notice notice-error" role="alert"/);
  }
});

test('conversion group mode controls lock when existing link targets make the mode immutable', () => {
  const source = readSource('conversion-pool/ConversionGroupEditorDialog.tsx');
  assert.match(source, /editingGroup\.mode === 'link'/);
  assert.match(source, /editingGroup\.targetCount > 0/);
  assert.match(source, /disabled=\{saving \|\| modeLocked\}/);
});

test('dependency page styles do not rely on cross-page or forced danger overrides', () => {
  for (const fileName of ['category-management.css', 'conversion-pool.css']) {
    assert.doesNotMatch(readSource(fileName), /!important/);
  }

  assert.doesNotMatch(readSource('sections.css'), /^\s*\.text-danger\s*\{/m);
  assert.match(readSource('admin-foundation.css'), /^\.actions-cell \.text-danger \{/m);
});
