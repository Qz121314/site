import assert from 'node:assert/strict';
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

test(
  'bootstrap message article metadata is sanitized, sorted, deduplicated, and body-free',
  () => {
    const articles = getMessageArticlesFromBootstrap(
      bootstrapWithMessageArticles([
        {
          articleId: 'article-b',
          title: 'Beta',
          preview: 'Second',
          sortOrder: 20,
          body: '# Full Markdown must not escape bootstrap metadata',
        },
        {
          articleId: 'article-a',
          title: 'Alpha',
          preview: 'First',
          sortOrder: 10,
        },
        {
          articleId: 'article-a',
          title: 'Duplicate Alpha',
          preview: 'Duplicate',
          sortOrder: 30,
        },
        { articleId: '', title: 'Bad', preview: 'Bad', sortOrder: 0 },
        { articleId: 'article-c', title: 'Bad sort', preview: 'Bad', sortOrder: '1' },
        null,
      ]),
    );

    assert.deepEqual(articles, [
      { articleId: 'article-a', title: 'Alpha', preview: 'First', sortOrder: 10 },
      { articleId: 'article-b', title: 'Beta', preview: 'Second', sortOrder: 20 },
    ]);
    assert.equal('body' in articles[1], false);
    assert.deepEqual(
      getMessageArticlesFromBootstrap(bootstrapWithMessageArticles(undefined)),
      [],
    );
  },
);

test(
  'first visit treats every active message article as unread without support identity',
  () => {
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
  },
);

test(
  'marking one article read persists only its ID and leaves other active articles unread',
  () => {
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
  },
);

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

test(
  'editing article metadata does not make an already-read article unread again',
  () => {
    const storage = memoryStorage('["article-a"]');
    const active = [
      {
        articleId: 'article-a',
        title: 'Updated title',
        preview: 'Updated preview',
        sortOrder: 999,
      },
    ];

    assert.equal(
      countUnreadMessageArticles(active, readMessageArticleReadIds(storage)),
      0,
    );
  },
);

test(
  'messages badge composes independent support and article unread counts safely',
  () => {
    assert.equal(composeMessagesBadge(0, 2), 2);
    assert.equal(composeMessagesBadge(3, 2), 5);
    assert.equal(
      composeMessagesBadge(0, 2),
      2,
      'support reset must preserve article unread',
    );
    assert.equal(composeMessagesBadge(-1, Number.NaN), 0);
    assert.equal(composeMessagesBadge(2.9, 1.9), 3);
  },
);
