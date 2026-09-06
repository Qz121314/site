import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('generic Article detail is lazy, uses MarkdownContent, and marks only the active Article read', () => {
  const root = source('../src/StorefrontRoot.tsx');
  const page = source('../src/ArticlePage.tsx');

  assert.ok(root.includes("const ArticlePage = lazy(() => import('./ArticlePage'))"));
  assert.ok(root.includes("case 'article':"));
  assert.ok(page.includes("from './MarkdownContent'"));
  assert.ok(page.includes('loadArticleSnapshot'));
  assert.ok(page.includes('markMessageArticleRead(articleId)'));
  assert.ok(page.includes('item.articleId === articleId'));
  assert.ok(page.includes('href="/messages/"'));
});

test('Messages Article rows remain separate from support conversation data and only render on the list route', () => {
  const messagesPage = source('../src/MessagesPage.tsx');
  const articleList = source('../src/MessagesArticleList.tsx');
  const articleWorkspace = source('../src/MessagesArticleListWorkspace.tsx');

  assert.ok(messagesPage.includes("from './MessagesArticleListWorkspace'"));
  assert.ok(messagesPage.includes('getMessageArticlesFromBootstrap(bootstrap)'));
  assert.ok(messagesPage.includes('!compose && activeConversationRef === null'));
  assert.ok(articleWorkspace.includes('<MessagesArticleList'));
  assert.ok(articleWorkspace.includes('<MessagesPageContent'));
  assert.equal(articleWorkspace.includes('<MessageThreadPageContent'), false);

  assert.ok(articleList.includes('articleHref(article.articleId)'));
  assert.ok(articleList.includes('aria-label'));
  assert.ok(articleList.includes('Unread article'));
  assert.equal(articleList.includes('SupportConversation'), false);
  assert.equal(articleList.includes('conversationRef'), false);
});

test('StorefrontRoot composes support and Article unread without starting support runtime for Article routes', () => {
  const root = source('../src/StorefrontRoot.tsx');

  assert.ok(root.includes('const [supportUnread, setSupportUnread] = useState(0)'));
  assert.ok(root.includes('const articleUnread ='));
  assert.ok(root.includes('composeMessagesBadge(supportUnread, articleUnread)'));
  assert.ok(root.includes('onUnreadMessages={setSupportUnread}'));
  assert.ok(root.includes('if (!supportRuntimeEnabled) setSupportUnread(0)'));
  assert.equal(root.includes("route.type === 'article' ||"), false);
});
