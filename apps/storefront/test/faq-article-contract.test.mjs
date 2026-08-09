import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const faqSource = await readFile(new URL('../src/FaqPage.tsx', import.meta.url), 'utf8');
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const cssSource = await readFile(new URL('../src/faq-ui.css', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('FAQ is a title-only one-row-per-article directory without search or accordion expansion', () => {
  assert.match(faqSource, /<ul className="faq-article-list">/u);
  assert.match(faqSource, /<li key=\{article\.id\}>/u);
  assert.match(faqSource, /className="faq-article-row"/u);
  assert.match(faqSource, /<span>\{article\.title\}<\/span>/u);
  assert.match(faqSource, /href=\{faqArticleHref\(article\.id\)\}/u);
  assert.doesNotMatch(faqSource, /<details|<summary/u);
  assert.doesNotMatch(faqSource, /type="search"|searchPlaceholder/u);
});

test('FAQ article opens on a dedicated detail route and renders the published Markdown body', () => {
  assert.match(faqSource, /export function FaqArticlePage/u);
  assert.match(
    faqSource,
    /query\.data\?\.faqs\.find\(\(item\) => item\.id === articleRef\)/u,
  );
  assert.match(faqSource, /<MarkdownContent source=\{article\.body\} \/>/u);
  assert.match(faqSource, /className="faq-back-link" href="\/faq\/"/u);
});

test('FAQ list and article detail use the primary Storefront shell and keep FAQ navigation active', () => {
  assert.match(rootSource, /function FaqRoot\(/u);
  assert.match(rootSource, /case 'faq-article':/u);
  assert.match(rootSource, /<FaqDirectoryPage/u);
  assert.match(rootSource, /<FaqArticlePage/u);
  assert.match(rootSource, /<PrimaryShell activePath="\/faq\/"/u);
});

test('FAQ article UI is isolated, mobile-friendly, and consumes Theme Center variables', () => {
  assert.match(mainSource, /\.\/faq-ui\.css/u);
  assert.match(cssSource, /\.faq-article-row\s*\{[\s\S]*min-height:\s*58px/u);
  assert.match(
    cssSource,
    /\.faq-article-list\s*\{[\s\S]*--theme-primary-faq-background/u,
  );
  assert.match(
    cssSource,
    /\.faq-article-body\s*\{[\s\S]*--theme-primary-faq-background/u,
  );
  assert.match(cssSource, /@media \(max-width:\s*767px\)[\s\S]*\.faq-article-list/u);
});
