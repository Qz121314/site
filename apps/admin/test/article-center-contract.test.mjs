import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('Article Center uses the shared commercial management workspace primitives', async () => {
  const view = await source('../src/ArticleCenterView.tsx');
  const table = await source('../src/article-center/ArticleTable.tsx');
  const editor = await source('../src/article-center/ArticleEditorDialog.tsx');
  const deletion = await source('../src/article-center/DeleteArticleDialog.tsx');

  assert.match(view, /AdminToolbar/);
  assert.match(view, /AdminSearchField/);
  assert.match(view, /AdminSelectionBar/);
  assert.match(view, /AdminFeedbackState/);
  assert.match(view, /placeholder="搜索文章标题"/);
  assert.match(view, />\s*新建文章\s*</);
  assert.match(view, />\s*全部\s*</);
  assert.match(view, />\s*启用\s*</);
  assert.match(view, />\s*停用\s*</);
  assert.match(view, /<option value="default">默认顺序<\/option>/);
  assert.match(view, /<option value="title">标题<\/option>/);
  assert.match(view, /<option value="updated">更新时间<\/option>/);

  assert.match(table, /AdminStatusBadge/);
  for (const heading of ['标题', '状态', '排序', '更新时间', '操作']) {
    assert.match(table, new RegExp(`>${heading}<`));
  }
  assert.doesNotMatch(table, /MarkdownContent|article\.body/);

  assert.match(editor, /AdminDialog/);
  assert.match(editor, /Input/);
  assert.match(editor, /Textarea/);
  assert.match(editor, /AdminSegmentedControl/);
  assert.match(deletion, /AdminDialog/);
  assert.match(deletion, /确定删除《\$\{singleTitle\}》吗？/);
});

test('Article Center provides compact shared loading, empty, search-empty and retry states', async () => {
  const view = await source('../src/ArticleCenterView.tsx');

  assert.match(view, /kind="loading" title="正在读取文章…"/);
  assert.match(view, /kind="error"/);
  assert.match(view, /title="文章加载失败"/);
  assert.match(view, />\s*重试\s*</);
  assert.match(view, /'暂无文章'/);
  assert.match(view, /title="没有符合筛选条件的文章"/);
});

test('Article filters and sorts are client-side and title search does not inspect body', async () => {
  const view = await source('../src/ArticleCenterView.tsx');
  const adapter = await source('../src/article-center/api.ts');

  assert.match(view, /article\.title\.toLocaleLowerCase/);
  assert.doesNotMatch(view, /article\.body\.toLocaleLowerCase/);
  assert.match(view, /statusFilter === 'active'/);
  assert.match(view, /sortMode === 'title'/);
  assert.match(view, /sortMode === 'updated'/);
  assert.doesNotMatch(adapter, /fetch\(|adminFetch/);
});

test('legacy FAQ storage, Admin API and question mapping remain the compatibility layer', async () => {
  const adapter = await source('../src/article-center/api.ts');
  const transport = await source('../src/faq-management/api.ts');
  const workerFaqs = await source('../../worker/src/faqs/faqs.ts');

  assert.match(adapter, /fromLegacyFaq/);
  assert.match(adapter, /toLegacyFaqInput/);
  assert.match(transport, /\/api\/admin\/faqs/);
  assert.doesNotMatch(transport, /\/api\/admin\/articles/);
  assert.match(workerFaqs, /question:\s*string/);
  assert.match(workerFaqs, /FROM faqs/);
  assert.match(workerFaqs, /row\.question/);
});

test('Article Center CSS keeps natural workspace flow and responsive compact rows', async () => {
  const css = await source('../src/article-center.css');
  const manifest = await source('../src/admin.css');

  assert.match(manifest, /@import '\.\/article-center\.css';/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /\.article-table tr\s*\{[\s\S]*display:\s*grid/);
  assert.doesNotMatch(css, /\.article-center[^{]*\{[^}]*height:\s*100vh/);
});
