import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  catalogViewForResource,
  getAdminSecondaryItems,
  getCatalogWorkspaceContext,
} from '../src/admin-navigation.ts';

const sections = [
  { id: 'escorts', name: 'ESCORTS' },
  { id: 'dating', name: 'DATING' },
  { id: 'live-cam', name: 'LIVE CAM' },
];

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('catalog secondary navigation exposes structure and every section resource workspace', () => {
  const items = getAdminSecondaryItems('catalog', sections);
  assert.deepEqual(
    items.map(({ view, label, group }) => [view, label, group ?? null]),
    [
      ['sections', '分区管理', '结构'],
      ['products:escorts', '商品', 'ESCORTS'],
      ['categories:escorts', '分类', null],
      ['tags:escorts', '标签', null],
      ['products:dating', '商品', 'DATING'],
      ['categories:dating', '分类', null],
      ['tags:dating', '标签', null],
      ['products:live-cam', '商品', 'LIVE CAM'],
      ['categories:live-cam', '分类', null],
      ['tags:live-cam', '标签', null],
    ],
  );
  assert.equal(
    items.some((item) => item.label === '商品'),
    true,
  );
  assert.equal(
    items.some((item) => item.label === '分类'),
    true,
  );
  assert.equal(
    items.some((item) => item.label === '标签'),
    true,
  );
});

test('catalog workspace context deterministically separates section and resource type', () => {
  assert.deepEqual(getCatalogWorkspaceContext('products:dating'), {
    sectionId: 'dating',
    resource: 'products',
  });
  assert.deepEqual(getCatalogWorkspaceContext('categories:dating'), {
    sectionId: 'dating',
    resource: 'categories',
  });
  assert.deepEqual(getCatalogWorkspaceContext('tags:dating'), {
    sectionId: 'dating',
    resource: 'tags',
  });
  assert.equal(getCatalogWorkspaceContext('sections'), null);
});

test('catalog workspace switcher preserves the active section id', () => {
  assert.equal(catalogViewForResource('products', 'dating'), 'products:dating');
  assert.equal(catalogViewForResource('categories', 'dating'), 'categories:dating');
  assert.equal(catalogViewForResource('tags', 'dating'), 'tags:dating');
});

test('catalog sidebar selection identifies the exact resource route', async () => {
  const secondary = await source('../src/shell/AdminSecondarySidebar.tsx');
  assert.match(secondary, /item\.view === activeView/);
  assert.match(secondary, /aria-current=\{active \? 'page' : undefined\}/);
  assert.doesNotMatch(secondary, /sectionName.*·.*item\.label/);
});

test('catalog workspace switcher uses the shared segmented pattern and guarded navigation path', async () => {
  const dashboard = await source('../src/Dashboard.tsx');
  const shell = await source('../src/shell/AdminShell.tsx');
  const switcher = await source('../src/catalog/CatalogWorkspaceSwitcher.tsx');
  const sharedCss = await source('../src/admin-ui-system.css');
  const layoutCss = await source('../src/admin-section-workspace-nav.css');

  assert.match(dashboard, /onNavigate=\{requestView\}/);
  assert.match(shell, /<CatalogWorkspaceSwitcher/);
  assert.match(shell, /onNavigate=\{onNavigate\}/);
  assert.match(switcher, /AdminSegmentedControl/);
  assert.match(switcher, /AdminSegmentedItem/);
  assert.match(switcher, /selected=\{active\}/);
  assert.match(switcher, /current=\{active\}/);
  assert.match(switcher, /catalogViewForResource/);
  assert.doesNotMatch(
    switcher,
    /location\.hash|history\.(pushState|replaceState)|fetch\(/,
  );
  assert.match(sharedCss, /\.ui-segmented-control[\s\S]*overflow-x:\s*auto/);
  assert.match(sharedCss, /\.ui-segmented-item[\s\S]*min-height:\s*44px/);
  assert.match(
    sharedCss,
    /\.ui-segmented-item\.ui-button\.is-selected[\s\S]*background:/,
  );
  assert.match(
    sharedCss,
    /\.ui-segmented-item\.ui-button\.is-selected[\s\S]*border-color:/,
  );
  assert.match(sharedCss, /\.ui-segmented-item:focus-visible/);
  assert.match(layoutCss, /catalog-workspace-switcher/);
  assert.match(layoutCss, /@media \(max-width: 899px\)/);
  assert.doesNotMatch(layoutCss, /!important/);
});
