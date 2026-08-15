import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('customer service admin stylesheet matches rendered workbench classes', () => {
  const view = source('../src/CustomerServiceView.tsx');
  const css = source('../src/customer-service-connections.css');

  assert.ok(css.includes('.customer-service-toolbar-actions'));
  assert.ok(css.includes('.customer-service-search input'));
  assert.ok(css.includes('.selection-column'));
  assert.ok(css.includes('.actions-column'));
  assert.ok(css.includes('.table-actions'));
  assert.ok(css.includes('.table-action.is-danger'));
  assert.ok(!css.includes('.selection-cell'));
  assert.ok(!css.includes('.row-actions'));
  assert.ok(view.includes("event.key === 'Escape'"));
  assert.ok(view.includes('onMouseDown={(event) => event.stopPropagation()}'));
});
