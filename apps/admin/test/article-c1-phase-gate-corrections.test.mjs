import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { moveAndNormalizeArticleOrder } from '../src/article-center/article-order.ts';

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

function article(id, sortOrder, updatedAt) {
  return {
    id,
    title: id,
    body: '',
    sortOrder,
    isActive: true,
    createdAt: '2026-09-07T00:00:00Z',
    updatedAt,
    deletedAt: null,
  };
}

test('Article reorder normalizes duplicate sortOrder values after a move', () => {
  const original = [
    article('first', 10, '2026-09-07T03:00:00Z'),
    article('second', 10, '2026-09-07T02:00:00Z'),
    article('third', 20, '2026-09-07T01:00:00Z'),
  ];

  const reordered = moveAndNormalizeArticleOrder(original, 'second', -1);

  assert.ok(reordered);
  assert.deepEqual(
    reordered.map(({ id, sortOrder }) => ({ id, sortOrder })),
    [
      { id: 'second', sortOrder: 0 },
      { id: 'first', sortOrder: 10 },
      { id: 'third', sortOrder: 20 },
    ],
  );
  assert.deepEqual(
    original.map(({ id, sortOrder }) => ({ id, sortOrder })),
    [
      { id: 'first', sortOrder: 10 },
      { id: 'second', sortOrder: 10 },
      { id: 'third', sortOrder: 20 },
    ],
  );
});

test('Article reorder submits the complete normalized order in one request', async () => {
  const view = await source('../src/ArticleCenterView.tsx');

  assert.match(view, /moveAndNormalizeArticleOrder/);
  assert.match(view, /await reorderArticles\(\s*normalizedOrder\.map/);
  assert.doesNotMatch(view, /await reorderArticles\(\[/);
});

test('Article sort control is owned by the shared Select primitive', async () => {
  const view = await source('../src/ArticleCenterView.tsx');
  const select = await source('../src/components/ui/select.tsx');

  assert.match(view, /from '.\/components\/ui\/select'/);
  assert.match(view, /<Select/);
  assert.doesNotMatch(view, /<select/);
  assert.match(select, /SelectHTMLAttributes<HTMLSelectElement>/);
  assert.match(select, /cn\('ui-input', className\)/);
});

test('Article delete dialog uses operator-facing recovery copy', async () => {
  const deletion = await source('../src/article-center/DeleteArticleDialog.tsx');

  assert.match(deletion, /删除后文章会进入回收站，可稍后恢复。/);
  assert.doesNotMatch(deletion, /backend 删除语义/);
});
