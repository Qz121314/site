import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storage cleanup opens with one R2 page and makes deeper scanning explicit', () => {
  const view = source('../src/AssetLibraryView.tsx');
  const api = source('../src/asset-library/api.ts');

  assert.ok(view.includes('const scanFirstPage = useCallback(async () => {'));
  assert.ok(view.includes('const scanNextPage = useCallback(async () => {'));
  assert.ok(view.includes('const scanAllRemaining = useCallback(async () => {'));
  assert.ok(view.includes('void scanFirstPage();'));
  assert.ok(view.includes('继续扫描下一批'));
  assert.ok(view.includes('扫描全部'));
  assert.ok(view.includes('当前统计与清理列表仅覆盖已扫描范围'));
  assert.ok(api.includes("const query = new URLSearchParams({ limit: '500' });"));

  const firstPageStart = view.indexOf('const scanFirstPage = useCallback(async () => {');
  const nextPageStart = view.indexOf('const scanNextPage = useCallback(async () => {');
  const firstPageBlock = view.slice(firstPageStart, nextPageStart);
  assert.equal(firstPageBlock.includes('while ('), false);

  const autoScanStart = view.indexOf("if (tab === 'cleanup'");
  const autoScanEnd = view.indexOf('}, [', autoScanStart);
  const autoScanBlock = view.slice(autoScanStart, autoScanEnd);
  assert.ok(autoScanBlock.includes('scanFirstPage'));
  assert.equal(autoScanBlock.includes('scanAllRemaining'), false);
});
