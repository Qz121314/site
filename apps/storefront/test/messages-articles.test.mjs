import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MESSAGE_ARTICLE_READ_STORAGE_KEY,
  composeMessagesBadge,
  countUnreadMessageArticles,
  getMessageArticlesFromBootstrap,
  markMessageArticleRead,
  readMessageArticleReadIds,
} from '../src/messages-articles.ts';

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem(key) {
      return key === MESSAGE_ARTICLE_READ_STORAGE_KEY ? value : null;
    },
    setItem(key, nextValue) {
      if (key === MESSAGE_ARTICLE_READ_STORAGE_KEY) value = String(nextValue);
    },
    value() {
      return value;
    },
  };
}

function bootstrapWithMessageArticles(messageArticles) {
  return {
    site: {
      site: {
        navigation: { messageArticles },
      },
    },
  };
}

test('bootstrap metadata is sanitized, sorted, deduplicated, and body-free', () => {
  const articles = getMessageArticlesFromBootstrap(
    bootstrapWithMessageArticles([
      {
        articleId: 'article-b',
        title: 'Beta',
        preview: 'Second',
        backgroundObjectKey: ' media/messages/beta.webp ',
        sortOrder: 20,
        body: '# Full Markdown must not escape bootstrap metadata',
      },
      {
        articleId: 'article-a',
        title: 'Alpha',
        preview: 'First',
        backgroundObjectKey: '   ',
        sortOrder: 10,
      },
      {
        articleId: 'article-a',
        title: 'Duplicate Alpha',
        preview: 'Duplicate',
        sortOrder: 30,
      },
      { articleId: '', title: 'Bad', preview: 'Bad', sortOrder: 0 },
      {
        articleId: 'article-c',
        title: 'Bad sort',
        preview: 'Bad',
        sortOrder: '1',
      },
      null,
    ]),
  );

  assert.deepEqual(articles, [
    {
      articleId: 'article-a',
      title: 'Alpha',
      preview: 'First',
      backgroundObjectKey: null,
      sortOrder: 10,
    },
    {
      articleId: 'article-b',
      title: 'Beta',
      preview: 'Second',
      backgroundObjectKey: 'media/messages/beta.webp',
      sortOrder: 20,
    },
  ]);
  assert.equal('body' in articles[1], false);
  assert.deepEqual(
    getMessageArticlesFromBootstrap(bootstrapWithMessageArticles(undefined)),
    [],
  );
});

test('first visit treats active Articles as unread without support identity', () => {
  const active = getMessageArticlesFromBootstrap(
    bootstrapWithMessageArticles([
      { articleId: 'article-a', title: 'A', preview: 'A', sortOrder: 0 },
      { articleId: 'article-b', title: 'B', preview: 'B', sortOrder: 1 },
    ]),
  );
  const storage = memoryStorage();

  assert.deepEqual([...readMessageArticleReadIds(storage)], []);
  assert.equal(
    countUnreadMessageArticles(active, readMessageArticleReadIds(storage)),
    2,
  );
});

test('marking an Article read persists only its Article ID', () => {
  const active = [
    { articleId: 'article-a', title: 'A', preview: 'A', sortOrder: 0 },
    { articleId: 'article-b', title: 'B', preview: 'B', sortOrder: 1 },
    { articleId: 'article-c', title: 'C', preview: 'C', sortOrder: 2 },
  ];
  const storage = memoryStorage();

  markMessageArticleRead('article-b', storage, false);

  assert.deepEqual(JSON.parse(storage.value()), ['article-b']);
  const readIds = readMessageArticleReadIds(storage);
  assert.equal(readIds.has('article-b'), true);
  assert.equal(readIds.has('article-a'), false);
  assert.equal(countUnreadMessageArticles(active, readIds), 2);
});

test('malformed and duplicate localStorage state recovers safely', () => {
  assert.deepEqual([...readMessageArticleReadIds(memoryStorage('{bad json'))], []);
  assert.deepEqual(
    [
      ...readMessageArticleReadIds(
        memoryStorage('["article-a","article-a",4,null,"article-b"]'),
      ),
    ],
    ['article-a', 'article-b'],
  );
});

test('ghost IDs and inactive articles do not affect current unread count', () => {
  const storage = memoryStorage('["ghost","article-a"]');
  const active = [
    { articleId: 'article-a', title: 'A', preview: 'A', sortOrder: 0 },
    { articleId: 'article-b', title: 'B', preview: 'B', sortOrder: 1 },
  ];

  assert.equal(
    countUnreadMessageArticles(active, readMessageArticleReadIds(storage)),
    1,
  );
});

test('editing Article metadata does not reset Article-ID read state', () => {
  const storage = memoryStorage('["article-a"]');
  const original = [
    {
      articleId: 'article-a',
      title: 'Original title',
      preview: 'Original preview',
      backgroundObjectKey: 'media/messages/original.webp',
      sortOrder: 0,
    },
  ];
  const updated = [
    {
      articleId: 'article-a',
      title: 'Updated title',
      preview: 'Updated preview',
      backgroundObjectKey: 'media/messages/changed.webp',
      sortOrder: 999,
    },
  ];

  assert.equal(
    countUnreadMessageArticles(original, readMessageArticleReadIds(storage)),
    0,
  );
  assert.equal(
    countUnreadMessageArticles(updated, readMessageArticleReadIds(storage)),
    0,
  );
});

test('Messages badge composes support and Article unread independently', () => {
  assert.equal(composeMessagesBadge(0, 2), 2);
  assert.equal(composeMessagesBadge(3, 2), 5);
  assert.equal(
    composeMessagesBadge(0, 2),
    2,
    'support reset must preserve article unread',
  );
  assert.equal(composeMessagesBadge(-1, Number.NaN), 0);
  assert.equal(composeMessagesBadge(2.9, 1.9), 3);
});

test('Messages Article presentation remains bootstrap-only with no fetch owner', () => {
  const helperSource = readFileSync(
    new URL('../src/messages-articles.ts', import.meta.url),
    'utf8',
  );
  const listSource = readFileSync(
    new URL('../src/MessagesArticleList.tsx', import.meta.url),
    'utf8',
  );
  const workspaceSource = readFileSync(
    new URL('../src/MessagesArticleListWorkspace.tsx', import.meta.url),
    'utf8',
  );
  const source = `${helperSource}\n${listSource}\n${workspaceSource}`;

  assert.doesNotMatch(source, /\bfetch\s*\(/u);
  assert.doesNotMatch(source, /\/api\/[^'"`]*(?:article|media)/iu);
  assert.doesNotMatch(source, /siteSupportGateway|loadPublicSupportConnections/u);
  assert.match(workspaceSource, /getQueryData<StorefrontBootstrap>/u);
  assert.match(listSource, /mediaUrl\(mediaBaseUrl, article\.backgroundObjectKey\)/u);
  assert.match(helperSource, /site:messages:read-articles/u);
});
