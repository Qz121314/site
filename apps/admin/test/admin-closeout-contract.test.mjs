import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url));

function readSource(relativePath) {
  return fs.readFileSync(path.join(sourceDirectory, relativePath), 'utf8');
}

test('remaining editor save failures stay visible inside open dialogs', () => {
  for (const relativePath of [
    'product-management/ProductEditorDialog.tsx',
    'FaqManagementView.tsx',
    'CustomerServiceView.tsx',
  ]) {
    const source = readSource(relativePath);
    assert.match(source, /errorMessage/);
    assert.match(source, /className="notice notice-error[^"\n]*" role="alert"/);
  }

  assert.match(readSource('ProductManagementView.tsx'), /!editorOpen && errorMessage/);
  assert.match(readSource('FaqManagementView.tsx'), /!editorOpen && errorMessage/);
  assert.match(readSource('CustomerServiceView.tsx'), /!editorOpen && errorMessage/);
});

test('FAQ and customer-service forms expose server input limits to the browser', () => {
  const faq = readSource('FaqManagementView.tsx');
  assert.match(faq, /autoFocus required maxLength=\{300\}/);
  assert.match(faq, /step=\{1\} required/);
  assert.match(faq, /<textarea value=\{form\.body\} required maxLength=\{20_000\}/);

  const customerService = readSource('CustomerServiceView.tsx');
  assert.match(customerService, /autoFocus\s+required\s+maxLength=\{120\}/);
  assert.match(customerService, /type="url"\s+required\s+maxLength=\{1000\}/);
});

test('theme and logout failures use recoverable in-app feedback', () => {
  const theme = readSource('ThemeCenterView.tsx');
  assert.match(theme, /const loadThemeCenter = useCallback/);
  assert.match(theme, /settings-card settings-error-state/);
  assert.match(theme, /重新加载/);

  const app = readSource('App.tsx');
  assert.doesNotMatch(app, /window\.alert/);
  assert.match(app, /logoutError/);
  assert.match(readSource('Dashboard.tsx'), /logoutError/);
});

test('paged media reads use the shared admin session pipeline', () => {
  const mediaPageApi = readSource('asset-library/media-library-page-api.ts');
  assert.match(mediaPageApi, /import \{ adminFetch \} from '\.\.\/admin-fetch';/);
  assert.match(mediaPageApi, /await adminFetch\(/);
  assert.doesNotMatch(mediaPageApi, /await fetch\(/);
});
