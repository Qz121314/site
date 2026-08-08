import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url));

function readSource(relativePath) {
  return fs.readFileSync(path.join(sourceDirectory, relativePath), 'utf8');
}

test('section save failures remain visible inside the open editor', () => {
  const editor = readSource('section-management/SectionEditorDialog.tsx');
  assert.match(editor, /errorMessage/);
  assert.match(editor, /className="notice notice-error" role="alert"/);
  assert.match(editor, /required[\s\S]*maxLength=\{100\}/);
  assert.match(editor, /max="1000000"/);
});

test('publish status failures have a visible retry path', () => {
  const dashboard = readSource('Dashboard.tsx');
  assert.match(dashboard, /publishStatusError/);
  assert.match(dashboard, /className="publish-status-error" role="alert"/);
  assert.match(dashboard, /重新读取/);
});

test('section and publish styles do not rely on forced overrides', () => {
  for (const fileName of ['sections.css', 'admin-publish.css']) {
    assert.doesNotMatch(readSource(fileName), /!important/);
  }
});
