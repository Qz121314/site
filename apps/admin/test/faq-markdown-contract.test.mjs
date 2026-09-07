import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('FAQ editor keeps raw Markdown as the editable and persisted source', async () => {
  const faq = await source('../src/FaqManagementView.tsx');

  assert.match(faq, /htmlFor="faq-body"/);
  assert.match(faq, /id="faq-body"/);
  assert.match(faq, /value=\{form\.body\}/);
  assert.match(faq, /body:\s*event\.target\.value/);
  assert.match(faq, /updateFaq\(editingFaq\.id, form\)/);
  assert.match(faq, /createFaq\(form\)/);
  assert.doesNotMatch(faq, /body:\s*form\.body\.trim\(\)/);
  assert.match(faq, /AdminSegmentedControl/);
  assert.match(faq, /AdminSegmentedItem/);
  assert.match(faq, /selected=\{editorMode === 'edit'\}/);
  assert.match(faq, /selected=\{editorMode === 'preview'\}/);
});

test('Admin FAQ preview reuses the shared MarkdownContent renderer without backend requests', async () => {
  const faq = await source('../src/FaqManagementView.tsx');
  const preview = await source('../src/faq-management/MarkdownPreview.tsx');

  assert.match(faq, /<MarkdownPreview source=\{form\.body\}/);
  assert.match(preview, /@site\/storefront-ui\/markdown-content/);
  assert.match(preview, /<MarkdownContent source=\{source\}/);
  assert.doesNotMatch(preview, /parseMarkdown|fetch\(|adminFetch|createFaq|updateFaq/);
});

test('Storefront FAQ and generic Article routes keep using the same Markdown renderer adapter', async () => {
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

test('FAQ publish mapping remains owned by the faq module', async () => {
  const dashboard = await source('../src/Dashboard.tsx');
  assert.match(dashboard, /if \(view === 'faq'\) return 'faq';/);
});
