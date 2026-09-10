import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('Article editor preserves raw Markdown source', async () => {
  const view = await source('../src/ArticleCenterView.tsx');
  const editor = await source('../src/article-center/ArticleEditorDialog.tsx');
  const adapter = await source('../src/article-center/api.ts');

  assert.match(editor, /value=\{form\.body\}/);
  assert.match(editor, /body:\s*event\.target\.value/);
  assert.match(view, /const articleForm = \{ \.\.\.form, title \}/);
  assert.match(view, /updateArticle\(editingArticle\.id, form\)/);
  assert.match(view, /createArticle\(articleForm\)/);
  assert.doesNotMatch(view, /body:\s*form\.body\.trim\(\)/);
  assert.doesNotMatch(editor, /body:\s*form\.body\.trim\(\)/);
  assert.doesNotMatch(adapter, /body:\s*input\.body\.trim\(\)/);
  assert.match(editor, /AdminSegmentedControl/);
  assert.match(editor, />\s*编辑\s*</);
  assert.match(editor, />\s*预览\s*</);
});

test('Admin Article preview stays client-side and shared', async () => {
  const editor = await source('../src/article-center/ArticleEditorDialog.tsx');
  const preview = await source('../src/article-center/MarkdownPreview.tsx');

  assert.match(editor, /<MarkdownPreview markdown=\{form\.body\}/);
  assert.match(preview, /@site\/storefront-ui\/markdown-content/);
  assert.match(preview, /<MarkdownContent source=\{markdown\}/);
  assert.doesNotMatch(
    preview,
    /parseMarkdown|fetch\(|adminFetch|createArticle|updateArticle/,
  );
});

test('Article Admin adapter preserves FAQ transport', async () => {
  const adapter = await source('../src/article-center/api.ts');
  const legacyTransport = await source('../src/faq-management/api.ts');

  assert.match(adapter, /isActive:\s*faq\.isEnabled/);
  assert.match(adapter, /isEnabled:\s*input\.isActive/);
  assert.match(legacyTransport, /\/api\/admin\/faqs/);
  assert.doesNotMatch(adapter, /\/api\/admin\/articles/);
  assert.doesNotMatch(legacyTransport, /\/api\/admin\/articles/);
});

test('Storefront routes keep the shared Markdown adapter', async () => {
  const faqPage = await source('../../storefront/src/FaqPage.tsx');
  const articlePage = await source('../../storefront/src/ArticlePage.tsx');
  const storefrontMarkdown = await source('../../storefront/src/MarkdownContent.tsx');

  assert.match(faqPage, /<MarkdownContent source=\{article\.body\}/);
  assert.match(articlePage, /<MarkdownContent source=\{article\.body\}/);
  assert.match(storefrontMarkdown, /@site\/storefront-ui\/markdown-content/);
  assert.match(storefrontMarkdown, /ResilientImage/);
  assert.doesNotMatch(
    storefrontMarkdown,
    /function renderInline|function renderBlock|parseMarkdown/,
  );
});

test('Article Center keeps the faq publish mapping', async () => {
  const dashboard = await source('../src/Dashboard.tsx');
  const compatibilityView = await source('../src/FaqManagementView.tsx');

  assert.match(dashboard, /if \(view === 'faq'\) return 'faq';/);
  assert.match(compatibilityView, /ArticleCenterView as FaqManagementView/);
});
