import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  addDraftArticle,
  draftsEqual,
  moveDraftArticle,
  normalizeDraft,
  removeDraftArticle,
  setDraftBackground,
  toCanonicalPayload,
} from '../src/experience/messages-articles/draft.ts';
import {
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

test('GET hydration parses Messages Article placement rows in server order', async () => {
  installBrowserStubs();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(input, '/api/admin/message-articles');
    assert.equal(init?.method, undefined);
    return jsonResponse({
      articles: [
        {
          articleId: 'article-b',
          title: 'B',
          backgroundMediaId: 'media-b',
          sortOrder: 1,
          enabled: true,
        },
        {
          articleId: 'article-a',
          title: 'A',
          backgroundMediaId: null,
          sortOrder: 0,
          enabled: true,
        },
      ],
    });
  };
  try {
    const rows = await fetchMessageArticlePlacements();
    assert.deepEqual(
      rows.map(({ articleId, backgroundMediaId, sortOrder }) => ({
        articleId,
        backgroundMediaId,
        sortOrder,
      })),
      [
        { articleId: 'article-a', backgroundMediaId: null, sortOrder: 0 },
        { articleId: 'article-b', backgroundMediaId: 'media-b', sortOrder: 1 },
      ],
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('canonical PUT sends articles payload and never legacy articleIds', async () => {
  installBrowserStubs();
  const previousFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input, init };
    return jsonResponse({
      articles: [
        {
          articleId: 'article-a',
          title: 'A',
          backgroundMediaId: 'media-a',
          sortOrder: 0,
          enabled: true,
        },
      ],
    });
  };
  try {
    await saveMessageArticlePlacements([
      { articleId: 'article-a', backgroundMediaId: 'media-a' },
    ]);
    assert.equal(captured.input, '/api/admin/message-articles');
    assert.equal(captured.init.method, 'PUT');
    assert.equal(captured.init.headers['x-admin-request'], '1');
    const body = JSON.parse(captured.init.body);
    assert.deepEqual(body, {
      articles: [{ articleId: 'article-a', backgroundMediaId: 'media-a' }],
    });
    assert.equal('articleIds' in body, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('draft hydration removes duplicate article IDs without mutating placement data', () => {
  assert.deepEqual(
    normalizeDraft([
      { articleId: 'a', backgroundMediaId: null },
      { articleId: 'a', backgroundMediaId: 'ignored' },
      { articleId: 'b', backgroundMediaId: 'media-b' },
    ]),
    [
      { articleId: 'a', backgroundMediaId: null },
      { articleId: 'b', backgroundMediaId: 'media-b' },
    ],
  );
});

test('add prevents duplicate article IDs and remove keeps remaining order', () => {
  const initial = [{ articleId: 'a', backgroundMediaId: null }];
  assert.equal(addDraftArticle(initial, 'a'), initial);
  const added = addDraftArticle(initial, 'b');
  assert.deepEqual(added, [
    { articleId: 'a', backgroundMediaId: null },
    { articleId: 'b', backgroundMediaId: null },
  ]);
  assert.deepEqual(removeDraftArticle(added, 'a'), [
    { articleId: 'b', backgroundMediaId: null },
  ]);
});

test('reorder is stable and canonical payload follows current UI array ordering', () => {
  const initial = [
    { articleId: 'a', backgroundMediaId: null },
    { articleId: 'b', backgroundMediaId: 'media-b' },
    { articleId: 'c', backgroundMediaId: null },
  ];
  const moved = moveDraftArticle(initial, 'c', -1);
  assert.deepEqual(toCanonicalPayload(moved), {
    articles: [
      { articleId: 'a', backgroundMediaId: null },
      { articleId: 'c', backgroundMediaId: null },
      { articleId: 'b', backgroundMediaId: 'media-b' },
    ],
  });
  assert.deepEqual(
    initial.map((row) => row.articleId),
    ['a', 'b', 'c'],
  );
});

test('background select, change and clear are local draft operations', () => {
  const initial = [{ articleId: 'a', backgroundMediaId: null }];
  const selected = setDraftBackground(initial, 'a', 'media-1');
  assert.equal(selected[0].backgroundMediaId, 'media-1');
  const changed = setDraftBackground(selected, 'a', 'media-2');
  assert.equal(changed[0].backgroundMediaId, 'media-2');
  const cleared = setDraftBackground(changed, 'a', null);
  assert.equal(cleared[0].backgroundMediaId, null);
});

test('dirty comparison tracks order and placement background state', () => {
  const saved = [
    { articleId: 'a', backgroundMediaId: null },
    { articleId: 'b', backgroundMediaId: null },
  ];
  assert.equal(
    draftsEqual(
      saved,
      saved.map((row) => ({ ...row })),
    ),
    true,
  );
  assert.equal(draftsEqual(saved, moveDraftArticle(saved, 'b', -1)), false);
  assert.equal(draftsEqual(saved, setDraftBackground(saved, 'a', 'media-a')), false);
});

test('Messages Articles UI reuses Article Center and Asset Library owners', async () => {
  const source = await readFile(componentPath, 'utf8');
  assert.match(source, /fetchArticles\('active'\)/);
  assert.match(source, /fetchMediaLibrary\(\{ kind: 'image' \}\)/);
  assert.match(source, /brandingAssetPreviewUrl/);
  assert.match(source, /onNavigate\('faq'\)/);
  assert.doesNotMatch(source, /ArticleEditorDialog/);
  assert.doesNotMatch(source, /assignMediaRole/);
  assert.doesNotMatch(source, /uploadMediaAsset/);
});

test('Add Article flow is searchable, multi-select and excludes existing placement IDs', async () => {
  const source = await readFile(componentPath, 'utf8');
  assert.match(source, /existingIds\.has\(article\.id\)/);
  assert.match(source, /aria-multiselectable="true"/);
  assert.match(source, /搜索文章标题或正文/);
  assert.match(source, /addDraftArticle/);
});

test('workspace exposes explicit save, retry and local dirty state', async () => {
  const source = await readFile(componentPath, 'utf8');
  assert.match(source, /const dirty = !draftsEqual\(draft, serverDraft\)/);
  assert.match(source, /saveMessageArticlePlacements\(draft\)/);
  assert.match(source, /重试保存/);
  assert.match(source, /有未保存修改/);
  assert.match(source, /setServerDraft\(next\)/);
  assert.match(source, /useAdminDirtySource\('messages-articles'/);
});

test('existing Messages settings remain mounted above the independent Messages Articles workspace', async () => {
  const source = await readFile(messagesViewPath, 'utf8');
  assert.match(source, /messages-experience-summary/);
  assert.match(source, /\/messages\//);
  assert.match(source, /onNavigate\('navigation'\)/);
  assert.match(source, /<MessagesArticlesSection onNavigate=\{onNavigate\} \/>/);
});

test('C2 introduces no writable enabled semantic or Storefront rendering dependency', async () => {
  const [source, apiSource] = await Promise.all([
    readFile(componentPath, 'utf8'),
    readFile(apiPath, 'utf8'),
  ]);
  assert.doesNotMatch(source, /isEnabled|showInMessages|isMessageArticle/);
  assert.doesNotMatch(apiSource, /isEnabled|showInMessages|isMessageArticle|articleIds/);
  assert.doesNotMatch(
    source,
    /apps\/storefront|MessagesArticleList|site:messages:read-articles/,
  );
});

test('responsive contract keeps content scrollable and mobile touch controls at least 44px', async () => {
  const css = await readFile(cssPath, 'utf8');
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /overflow: auto/);
  assert.doesNotMatch(css, /height:\s*100vh|max-height:\s*100vh/);
});

test('Admin preview explicitly remains a configuration preview rather than Storefront visual contract', async () => {
  const source = await readFile(componentPath, 'utf8');
  assert.match(source, /不代表最终 Storefront Messages 卡片视觉/);
  assert.match(source, /Placement 预览/);
});
