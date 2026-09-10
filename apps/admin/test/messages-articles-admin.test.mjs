import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fetchArticles } from '../src/article-center/api.ts';
import {
  addDraftCard,
  draftsEqual,
  moveDraftArticle,
  normalizeDraft,
  removeDraftArticle,
} from '../src/experience/messages-articles/draft.ts';
import {
  fetchMessageCardOptions,
  fetchMessageArticlePlacements,
  saveMessageArticlePlacements,
} from '../src/experience/messages-articles/api.ts';

const componentPath = new URL(
  '../src/experience/messages-articles/MessagesArticlesSection.tsx',
  import.meta.url,
);
const messagesViewPath = new URL(
  '../src/experience/MessagesExperienceView.tsx',
  import.meta.url,
);
const cssPath = new URL(
  '../src/experience/messages-articles/messages-articles.css',
  import.meta.url,
);
const adminCssPath = new URL('../src/admin.css', import.meta.url);
const mediaPickerPath = new URL(
  '../src/asset-library/MediaPickerDialog.tsx',
  import.meta.url,
);
const apiPath = new URL('../src/experience/messages-articles/api.ts', import.meta.url);

function installBrowserStubs() {
  globalThis.window = {
    location: { href: 'https://admin.test/admin/' },
    dispatchEvent() {},
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const cardA = {
  id: 'card-a',
  title: '了解活动',
  backgroundMediaId: null,
  targetKind: 'article',
  targetRef: 'article-a',
  targetLabel: '活动说明',
  sectionId: null,
  conversionGroupId: null,
  sortOrder: 0,
};

const cardB = {
  id: 'card-b',
  title: '打开 H5',
  backgroundMediaId: 'media-b',
  targetKind: 'page',
  targetRef: 'https://h5.example.com/pages/demo/',
  targetLabel: '演示页面',
  sectionId: 'section-a',
  conversionGroupId: 'group-a',
  sortOrder: 1,
};

test('GET hydration parses generic Message CTA cards in server order', async () => {
  installBrowserStubs();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(input, '/api/admin/message-articles');
    return jsonResponse({ cards: [cardB, cardA] });
  };
  try {
    const cards = await fetchMessageArticlePlacements();
    assert.deepEqual(
      cards.map(({ id }) => id),
      ['card-a', 'card-b'],
    );
    assert.equal(cards[1].targetKind, 'page');
    assert.equal(cards[1].targetRef, 'https://h5.example.com/pages/demo/');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('card options expose H5 origin readiness without inventing a page URL', async () => {
  installBrowserStubs();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(input, '/api/admin/message-articles/options');
    return jsonResponse({
      articles: [{ id: 'article-a', title: '活动说明' }],
      pages: [],
      h5OriginConfigured: false,
      conversionGroups: [],
    });
  };
  try {
    const options = await fetchMessageCardOptions();
    assert.equal(options.h5OriginConfigured, false);
    assert.deepEqual(options.pages, []);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Article scope='active' preserves isActive=false", async () => {
  installBrowserStubs();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(input, '/api/admin/faqs/?scope=active');
    return jsonResponse({
      faqs: [
        {
          id: 'inactive-article',
          title: 'Paused article',
          body: 'Body',
          sortOrder: 0,
          isEnabled: false,
          createdAt: '2026-09-07T00:00:00.000Z',
          updatedAt: '2026-09-07T00:00:00.000Z',
          deletedAt: null,
        },
      ],
    });
  };
  try {
    const articles = await fetchArticles('active');
    assert.equal(articles[0].isActive, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('PUT sends the generic cards payload and never the removed article contract', async () => {
  installBrowserStubs();
  const previousFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input, init };
    return jsonResponse({ cards: [cardA] });
  };
  try {
    await saveMessageArticlePlacements([
      {
        id: cardA.id,
        title: cardA.title,
        backgroundMediaId: cardA.backgroundMediaId,
        targetKind: cardA.targetKind,
        targetRef: cardA.targetRef,
        sectionId: cardA.sectionId,
        conversionGroupId: cardA.conversionGroupId,
      },
    ]);
    assert.equal(captured.input, '/api/admin/message-articles');
    assert.equal(captured.init.method, 'PUT');
    const body = JSON.parse(captured.init.body);
    assert.deepEqual(body.cards, [
      {
        id: 'card-a',
        title: '了解活动',
        backgroundMediaId: null,
        targetKind: 'article',
        targetRef: 'article-a',
        sectionId: null,
        conversionGroupId: null,
      },
    ]);
    assert.equal('articles' in body, false);
    assert.equal('articleIds' in body, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('draft operations de-duplicate by card ID, preserve order, and keep card targets', () => {
  assert.deepEqual(normalizeDraft([cardA, { ...cardA, title: 'duplicate' }, cardB]), [
    cardA,
    cardB,
  ]);
  assert.deepEqual(addDraftCard([], { ...cardA, id: 'new-card' }, 'media-a'), [
    { ...cardA, id: 'new-card', backgroundMediaId: 'media-a' },
  ]);
  const cards = [
    cardA,
    cardB,
    { ...cardA, id: 'card-c', targetRef: 'https://example.com' },
  ];
  const moved = moveDraftArticle(cards, 'card-c', -1);
  assert.deepEqual(
    moved.map(({ id }) => id),
    ['card-a', 'card-c', 'card-b'],
  );
  assert.deepEqual(
    removeDraftArticle(moved, 'card-c').map(({ id }) => id),
    ['card-a', 'card-b'],
  );
  assert.equal(
    draftsEqual(
      cards,
      cards.map((card) => ({ ...card })),
    ),
    true,
  );
  assert.equal(draftsEqual(cards, moved), false);
});

test('Messages CTA UI uses shared reference-only media selection and generic target fields', async () => {
  const [source, mediaPicker, apiSource] = await Promise.all([
    readFile(componentPath, 'utf8'),
    readFile(mediaPickerPath, 'utf8'),
    readFile(apiPath, 'utf8'),
  ]);
  assert.match(source, /fetchMessageCardOptions/);
  assert.match(source, /卡片标题（行动号召）/);
  assert.match(source, /targetKind/);
  assert.match(source, /targetRef/);
  assert.match(source, /conversionGroupId/);
  assert.match(source, /selectionMode="reference-only"/);
  assert.match(source, /allowedKinds=\{\['image'\]\}/);
  assert.match(source, /h5OriginConfigured/);
  assert.match(mediaPicker, /fetchMediaLibrary\(\)/);
  assert.doesNotMatch(source, /fetchMediaLibrary/);
  assert.doesNotMatch(source, /ArticleEditorDialog/);
  assert.doesNotMatch(source, /uploadMediaAsset/);
  assert.doesNotMatch(apiSource, /articleIds|showInMessages|isMessageArticle/);
});

test('workspace exposes explicit save, retry, and local dirty state', async () => {
  const source = await readFile(componentPath, 'utf8');
  assert.match(source, /const dirty = !draftsEqual\(draft, serverDraft\)/);
  assert.match(source, /saveMessageArticlePlacements\(draft\)/);
  assert.match(source, /重试/);
  assert.match(source, /disabled=\{!dirty\}/);
  assert.match(source, /setServerDraft\(cards\)/);
  assert.match(source, /useAdminDirtySource\('messages-articles'/);
});

test('Messages settings keep the independent CTA workspace mounted', async () => {
  const source = await readFile(messagesViewPath, 'utf8');
  assert.match(source, /<MessagesArticlesSection/);
  assert.match(source, /onActionsChange=\{onActionsChange\}/);
  assert.doesNotMatch(source, /messages-experience-summary/);
});

test('responsive CSS keeps content scrollable and touch controls usable', async () => {
  const [css, adminCss] = await Promise.all([
    readFile(cssPath, 'utf8'),
    readFile(adminCssPath, 'utf8'),
  ]);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /overflow: auto/);
  assert.doesNotMatch(css, /height:\s*100vh|max-height:\s*100vh/);
  assert.match(adminCss, /experience\/messages-articles\/messages-articles\.css/);
});
