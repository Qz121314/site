import assert from 'node:assert/strict';
import test from 'node:test';

const selection = await import('../src/components/ui/management-selection.ts');
const dialogBehavior = await import('../src/components/ui/dialog-behavior.ts');

test('selection click toggles a row without losing unrelated selection', () => {
  const current = new Set(['product-a', 'offscreen-product']);
  const next = selection.toggleSelection(current, 'product-b');

  assert.deepEqual([...next].sort(), ['offscreen-product', 'product-a', 'product-b']);
  assert.deepEqual([...current].sort(), ['offscreen-product', 'product-a']);

  const toggledOff = selection.toggleSelection(next, 'product-a');
  assert.deepEqual([...toggledOff].sort(), ['offscreen-product', 'product-b']);
});

test('bulk selection only changes visible rows and preserves offscreen selection', () => {
  const current = new Set(['offscreen-product']);
  const selected = selection.toggleVisibleSelection(
    current,
    ['product-a', 'product-b'],
    false,
  );
  assert.deepEqual([...selected].sort(), ['offscreen-product', 'product-a', 'product-b']);

  const deselected = selection.toggleVisibleSelection(
    selected,
    ['product-a', 'product-b'],
    true,
  );
  assert.deepEqual([...deselected], ['offscreen-product']);
});

test('dialog keyboard behavior dismisses on Escape unless close is disabled', () => {
  assert.equal(dialogBehavior.shouldDismissAdminDialogKey('Escape', false), true);
  assert.equal(dialogBehavior.shouldDismissAdminDialogKey('Escape', true), false);
  assert.equal(dialogBehavior.shouldDismissAdminDialogKey('Enter', false), false);
  assert.equal(dialogBehavior.isAdminDialogFocusTraversalKey('Tab'), true);
  assert.equal(dialogBehavior.isAdminDialogFocusTraversalKey('Escape'), false);
});
