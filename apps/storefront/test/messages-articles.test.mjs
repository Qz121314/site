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
        cardId: 'card-b',
        title: 'Beta',
        preview: 'Second',
        targetKind: 'article',
        targetRef: 'article-b',
        backgroundObjectKey: ' media/messages/beta.webp ',
        sortOrder: 20,
        body: '# Full Markdown must not escape bootstrap metadata',
      },
      {
        cardId: 'card-a',
        title: 'Alpha',
        preview: 'First',
        targetKind: 'article',
        targetRef: 'article-a',
        backgroundObjectKey: '   ',
        sortOrder: 10,
      },
      {
        cardId: 'card-a',
        title: 'Duplicate Alpha',
        preview: 'Duplicate',
        targetKind: 'article',
        targetRef: 'article-a',
        sortOrder: 30,
      },
      {
        cardId: '',
        title: 'Bad',
        preview: 'Bad',
        targetKind: 'article',
        targetRef: 'bad',
        sortOrder: 0,
      },
      {
        cardId: 'card-c',
        title: 'Bad sort',
        preview: 'Bad',
        targetKind: 'article',
        targetRef: 'article-c',
        sortOrder: '1',
      },
      null,
    ]),
  );

  assert.deepEqual(articles, [
    {
      cardId: 'card-a',
      title: 'Alpha',
      preview: 'First',
      targetKind: 'article',
      targetRef: 'article-a',
      sectionId: null,
      conversionGroupId: null,
      backgroundObjectKey: null,
      sortOrder: 10,
    },
    {
      cardId: 'card-b',
      title: 'Beta',
      preview: 'Second',
      targetKind: 'article',
      targetRef: 'article-b',
      sectionId: null,
      conversionGroupId: null,
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
      {
        cardId: 'card-a',
        title: 'A',
        preview: 'A',
        targetKind: 'article',
        targetRef: 'article-a',
        sortOrder: 0,
      },
      {
        cardId: 'card-b',
        title: 'B',
        preview: 'B',
        targetKind: 'article',
        targetRef: 'article-b',
        sortOrder: 1,
      },
    ]),
  );
  const storage = memoryStorage();

  assert.deepEqual([...readMessageArticleReadIds(storage)], []);
  assert.equal(countUnreadMessageArticles(active, readMessageArticleReadIds(storage)), 2);
});

test('marking an Article read persists only its Article ID', () => {
  const active = [
    {
      cardId: 'card-a',
      title: 'A',
      preview: 'A',
      targetKind: 'article',
      targetRef: 'article-a',
      sortOrder: 0,
    },
    {
      cardId: 'card-b',
      title: 'B',
      preview: 'B',
      targetKind: 'article',
      targetRef: 'article-b',
      sortOrder: 1,
    },
    {
      cardId: 'card-c',
      title: 'C',
      preview: 'C',
      targetKind: 'article',
      targetRef: 'article-c',
      sortOrder: 2,
    },
  ];
  const storage = memoryStorage();

  markMessageArticleRead('card-b', storage, false);

  assert.deepEqual(JSON.parse(storage.value()), ['card-b']);
  const readIds = readMessageArticleReadIds(storage);
  assert.equal(readIds.has('card-b'), true);
  assert.equal(readIds.has('card-a'), false);
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
  const storage = memoryStorage('["ghost","card-a"]');
  const active = [
    {
      cardId: 'card-a',
      title: 'A',
      preview: 'A',
      targetKind: 'article',
      targetRef: 'article-a',
      sortOrder: 0,
    },
    {
      cardId: 'card-b',
      title: 'B',
      preview: 'B',
      targetKind: 'article',
      targetRef: 'article-b',
      sortOrder: 1,
    },
  ];

  assert.equal(countUnreadMessageArticles(active, readMessageArticleReadIds(storage)), 1);
});

test('editing Article metadata does not reset Article-ID read state', () => {
  const storage = memoryStorage('["card-a"]');
  const original = [
    {
      cardId: 'card-a',
      title: 'Original title',
      preview: 'Original preview',
      backgroundObjectKey: 'media/messages/original.webp',
      targetKind: 'article',
      targetRef: 'article-a',
      sortOrder: 0,
    },
  ];
  const updated = [
    {
      cardId: 'card-a',
      title: 'Updated title',
      preview: 'Updated preview',
      backgroundObjectKey: 'media/messages/changed.webp',
      targetKind: 'article',
      targetRef: 'article-a',
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
