import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

const workspaces = [
  'ProductManagementView.tsx',
  'CategoryManagementView.tsx',
  'TagManagementView.tsx',
  'SectionManagementView.tsx',
  'AssetLibraryView.tsx',
  'ConversionPoolView.tsx',
];

test('all Phase D workspaces adopt the shared management toolbar contract', async () => {
  for (const file of workspaces) {
    const source = await read(file);
    assert.match(source, /AdminToolbar/);
    assert.match(source, /AdminSearchField/);
  }
});

test('catalog CRUD workspaces expose shared selection, feedback and scanable data rows', async () => {
  const product = await read('ProductManagementView.tsx');
  const category = await read('CategoryManagementView.tsx');
  const tag = await read('TagManagementView.tsx');
  const section = await read('SectionManagementView.tsx');
  const productTable = await read('product-management/ProductTable.tsx');
  const categoryTable = await read('category-management/CategoryTable.tsx');
  const sectionTable = await read('section-management/SectionTable.tsx');

  for (const source of [product, category, tag, section]) {
    assert.match(source, /AdminSelectionBar/);
    assert.match(source, /AdminSegmentedControl/);
  }
  for (const source of [productTable, categoryTable, tag, sectionTable]) {
    assert.match(source, /aria-selected/);
    assert.match(source, /ui-data-row/);
    assert.match(source, /aria-label=/);
  }
  for (const source of [productTable, categoryTable, tag, sectionTable]) {
    assert.match(source, /AdminFeedbackState|loading \?/);
  }
});

test('asset library keeps visual media cards while modernizing management and cleanup surfaces', async () => {
  const source = await read('AssetLibraryView.tsx');
  const cleanupTable = await read('asset-library/AssetTable.tsx');

  assert.match(source, /media-center-card/);
  assert.match(source, /AdminSelectionBar/);
  assert.match(source, /R2 图片筛选工具栏/);
  assert.match(source, /AdminFeedbackState/);
  assert.match(source, /CleanupAssetDialog/);
  assert.match(cleanupTable, /AdminStatusBadge/);
  assert.match(cleanupTable, /aria-selected/);
});

test('conversion pool uses shared dense table, status, selection and row action patterns', async () => {
  const source = await read('ConversionPoolView.tsx');

  assert.match(source, /ui-data-table/);
  assert.match(source, /AdminStatusBadge/);
  assert.match(source, /AdminSelectionBar/);
  assert.match(source, /ui-row-actions/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /aria-selected/);
});

test('management editors and destructive confirmations reuse AdminDialog', async () => {
  const files = [
    'product-management/ProductEditorDialog.tsx',
    'product-management/DeleteProductDialog.tsx',
    'category-management/CategoryEditorDialog.tsx',
    'category-management/DeleteCategoryDialog.tsx',
    'section-management/SectionEditorDialog.tsx',
    'section-management/DeleteSectionDialog.tsx',
    'conversion-pool/ConversionGroupEditorDialog.tsx',
    'conversion-pool/ConversionTargetEditorDialog.tsx',
    'asset-library/CleanupAssetDialog.tsx',
    'asset-library/MediaAssetPreviewDialog.tsx',
  ];

  for (const file of files) {
    const source = await read(file);
    assert.match(source, /AdminDialog/);
    assert.doesNotMatch(source, /admin-dialog-backdrop/);
  }

  const productEditor = await read('product-management/ProductEditorDialog.tsx');
  assert.match(productEditor, /requestClose/);
  assert.match(productEditor, /onClose=\{\(\) => void requestClose\(\)\}/);
});

test('product media picker is rendered outside the product editor stacking context', async () => {
  const picker = await read('asset-library/MediaLibraryPickerDialog.tsx');
  const pickerCss = await read('media-picker.css');

  assert.match(picker, /createPortal/);
  assert.match(picker, /createPortal\(dialog, document\.body\)/);
  assert.match(
    pickerCss,
    /\.media-picker-backdrop\s*\{[\s\S]*position:\s*fixed[\s\S]*z-index:\s*1300[\s\S]*inset:\s*0/u,
  );
});

test('Phase D shared CSS owns generic management patterns without important overrides', async () => {
  const css = await read('admin-ui-system.css');
  assert.match(css, /Phase D management workspaces/);
  assert.match(css, /\.ui-management-toolbar/);
  assert.match(css, /\.ui-management-selection-bar/);
  assert.match(css, /\.ui-data-row\.is-selected/);
  assert.match(css, /@media \(max-width: 760px\)/);
  const phaseD = css.split('Phase D management workspaces')[1] ?? '';
  assert.doesNotMatch(phaseD, /!important/);
});

test('Phase D source does not introduce direct fetch calls into UI-only workspace composition', async () => {
  for (const file of workspaces) {
    const source = await read(file);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
  }
});
