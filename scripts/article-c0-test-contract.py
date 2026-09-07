from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


article = "apps/worker/test/article-message-contract.test.mjs"
replace_once(
    article,
    """  let references = [\n    { article_id: 'article-a', sort_order: 20, is_enabled: 1 },\n    { article_id: 'article-b', sort_order: 10, is_enabled: 1 },\n  ];\n""",
    """  const media = new Map([\n    [\n      'media-ready',\n      {\n        id: 'media-ready',\n        status: 'ready',\n        deleted_at: null,\n        mime_type: 'image/webp',\n      },\n    ],\n    [\n      'media-deleted',\n      {\n        id: 'media-deleted',\n        status: 'deleted',\n        deleted_at: NOW,\n        mime_type: 'image/webp',\n      },\n    ],\n    [\n      'media-video',\n      { id: 'media-video', status: 'ready', deleted_at: null, mime_type: 'video/mp4' },\n    ],\n  ]);\n  let references = [\n    {\n      article_id: 'article-a',\n      background_media_id: null,\n      sort_order: 20,\n      is_enabled: 1,\n    },\n    {\n      article_id: 'article-b',\n      background_media_id: null,\n      sort_order: 10,\n      is_enabled: 1,\n    },\n  ];\n""",
)
replace_once(
    article,
    """          if (this.sql.includes('SELECT id FROM faqs')) {\n            return {\n              results: this.args\n                .filter((id) => articles.has(id) && !articles.get(id).deleted_at)\n                .map((id) => ({ id })),\n            };\n          }\n          throw new Error(`Unexpected all SQL: ${this.sql}`);\n""",
    """          if (this.sql.includes('SELECT id FROM faqs')) {\n            return {\n              results: this.args\n                .filter((id) => articles.has(id) && !articles.get(id).deleted_at)\n                .map((id) => ({ id })),\n            };\n          }\n          if (this.sql.includes('FROM media_assets')) {\n            return {\n              results: this.args\n                .map((id) => media.get(id))\n                .filter(\n                  (asset) =>\n                    asset &&\n                    asset.status === 'ready' &&\n                    asset.deleted_at === null &&\n                    asset.mime_type.startsWith('image/'),\n                )\n                .map((asset) => ({ id: asset.id })),\n            };\n          }\n          throw new Error(`Unexpected all SQL: ${this.sql}`);\n""",
)
replace_once(
    article,
    """        if (statement.sql.includes('INSERT INTO message_article_references')) {\n          references.push({\n            article_id: statement.args[0],\n            sort_order: statement.args[1],\n            is_enabled: 1,\n          });\n        }\n""",
    """        if (statement.sql.includes('INSERT INTO message_article_references')) {\n          if (statement.sql.includes('background_media_id')) {\n            references.push({\n              article_id: statement.args[0],\n              background_media_id: statement.args[1],\n              sort_order: statement.args[2],\n              is_enabled: statement.args[3],\n            });\n          } else {\n            references.push({\n              article_id: statement.args[0],\n              background_media_id: null,\n              sort_order: statement.args[1],\n              is_enabled: 1,\n            });\n          }\n        }\n""",
)
replace_once(
    article,
    """      { articleId: 'article-b', title: 'Article B', sortOrder: 10, enabled: true },\n      { articleId: 'article-a', title: 'Article A', sortOrder: 20, enabled: true },\n""",
    """      {\n        articleId: 'article-b',\n        title: 'Article B',\n        backgroundMediaId: null,\n        sortOrder: 10,\n        enabled: true,\n      },\n      {\n        articleId: 'article-a',\n        title: 'Article A',\n        backgroundMediaId: null,\n        sortOrder: 20,\n        enabled: true,\n      },\n""",
)
replace_once(
    article,
    """      { articleId: 'article-a', title: 'Article A', sortOrder: 0, enabled: true },\n      { articleId: 'article-b', title: 'Article B', sortOrder: 1, enabled: true },\n""",
    """      {\n        articleId: 'article-a',\n        title: 'Article A',\n        backgroundMediaId: null,\n        sortOrder: 0,\n        enabled: true,\n      },\n      {\n        articleId: 'article-b',\n        title: 'Article B',\n        backgroundMediaId: null,\n        sortOrder: 1,\n        enabled: true,\n      },\n""",
)
marker = """test('PUT /message-articles rejects duplicate, nonexistent, and deleted article ids before writes', async () => {\n"""
new_tests = r"""test('PUT /message-articles accepts placement presentation metadata, null backgrounds, ordering, and enabled state', async () => {
  const db = createMessageArticleDb();
  const app = withRequestId(adminMessageArticleRoutes);
  const response = await app.request(
    'https://admin.example.com/',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      body: JSON.stringify({
        articles: [
          {
            articleId: 'article-a',
            backgroundMediaId: 'media-ready',
            isEnabled: false,
          },
          { articleId: 'article-b', backgroundMediaId: null, isEnabled: true },
        ],
      }),
    },
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    articles: [
      {
        articleId: 'article-a',
        title: 'Article A',
        backgroundMediaId: 'media-ready',
        sortOrder: 0,
        enabled: false,
      },
      {
        articleId: 'article-b',
        title: 'Article B',
        backgroundMediaId: null,
        sortOrder: 1,
        enabled: true,
      },
    ],
  });
  assert.deepEqual(db.references, [
    {
      article_id: 'article-a',
      background_media_id: 'media-ready',
      sort_order: 0,
      is_enabled: 0,
    },
    {
      article_id: 'article-b',
      background_media_id: null,
      sort_order: 1,
      is_enabled: 1,
    },
  ]);
});

test('PUT /message-articles rejects unavailable or non-image background media before writes', async () => {
  for (const backgroundMediaId of ['missing-media', 'media-deleted', 'media-video']) {
    const db = createMessageArticleDb();
    const app = withRequestId(adminMessageArticleRoutes);
    const response = await app.request(
      'https://admin.example.com/',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
        body: JSON.stringify({
          articles: [{ articleId: 'article-a', backgroundMediaId }],
        }),
      },
      { DB: db },
    );

    assert.equal(response.status, 400);
    assert.equal(db.batches.length, 0);
  }
});

test('PUT /message-articles rejects duplicate placement article ids before writes', async () => {
  const db = createMessageArticleDb();
  const app = withRequestId(adminMessageArticleRoutes);
  const response = await app.request(
    'https://admin.example.com/',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      body: JSON.stringify({
        articles: [
          { articleId: 'article-a', backgroundMediaId: null },
          { articleId: 'article-a', backgroundMediaId: 'media-ready' },
        ],
      }),
    },
    { DB: db },
  );

  assert.equal(response.status, 400);
  assert.equal(db.batches.length, 0);
});

"""
replace_once(article, marker, new_tests + marker)
replace_once(
    article,
    """      {\n        article_id: 'article-b',\n        question: 'Messages only article',\n        answer: 'Messages article body keeps well-being and stay-ready wording.',\n        sort_order: 0,\n      },\n""",
    """      {\n        article_id: 'article-b',\n        question: 'Messages only article',\n        answer: 'Messages article body keeps well-being and stay-ready wording.',\n        background_object_key: 'media/messages/article-b.webp',\n        sort_order: 0,\n        is_enabled: 1,\n      },\n      {\n        article_id: 'article-a',\n        question: 'Enabled FAQ article',\n        answer: '# Welcome **everyone**',\n        background_object_key: 'media/messages/disabled.webp',\n        sort_order: 1,\n        is_enabled: 0,\n      },\n""",
)
replace_once(
    article,
    """    if (sql.includes('FROM message_article_references mar')) {\n      return state.messageArticles.map((row) => ({ ...row }));\n    }\n""",
    """    if (sql.includes('FROM message_article_references mar')) {\n      return state.messageArticles\n        .filter((row) => row.is_enabled !== 0)\n        .map((row) => ({ ...row }));\n    }\n""",
)
replace_once(
    article,
    """      preview: 'Messages article body keeps well-being and stay-ready wording.',\n      sortOrder: 0,\n""",
    """      preview: 'Messages article body keeps well-being and stay-ready wording.',\n      backgroundObjectKey: 'media/messages/article-b.webp',\n      sortOrder: 0,\n""",
)
append_marker = """test('faq module status becomes dirty when Message Article placement changes', async () => {\n"""
fallback_test = r"""test('faq publication keeps a placement and publishes null when background media is unavailable', async () => {
  const db = createPublicationDb();
  db.state.messageArticles[0].background_object_key = null;
  const bucket = createPublicationBucket();

  await publishModularStorefront(db, bucket, 'publish-request-missing-background', 'faq');
  const messages = writtenJson(bucket, '/messages.json');
  assert.deepEqual(messages.value.articles, [
    {
      articleId: 'article-b',
      title: 'Messages only article',
      preview: 'Messages article body keeps well-being and stay-ready wording.',
      backgroundObjectKey: null,
      sortOrder: 0,
    },
  ]);
});

"""
replace_once(article, append_marker, fallback_test + append_marker)

bootstrap = "apps/worker/test/public-bootstrap-snapshot.test.mjs"
replace_once(
    bootstrap,
    """          preview: 'Short preview',\n          sortOrder: 0,\n          body: '# Full Markdown that must not enter bootstrap',\n""",
    """          preview: 'Short preview',\n          backgroundObjectKey: 'media/messages/announcement.webp',\n          sortOrder: 0,\n          body: '# Full Markdown that must not enter bootstrap',\n""",
)
replace_once(
    bootstrap,
    """      preview: 'Short preview',\n      sortOrder: 0,\n""",
    """      preview: 'Short preview',\n      backgroundObjectKey: 'media/messages/announcement.webp',\n      sortOrder: 0,\n""",
)
legacy_marker = """test('bootstrap safely falls back to an empty Messages Article list for an older faq publication without messages.json', async () => {\n"""
legacy_test = r"""test('bootstrap accepts legacy Messages Article metadata without a background field', async () => {
  const objects = sourceObjects({
    messages: {
      schemaVersion: 2,
      moduleKey: 'faq',
      articles: [
        {
          articleId: 'article-legacy',
          title: 'Legacy article',
          preview: 'Legacy preview',
          sortOrder: 0,
        },
      ],
    },
  });
  const bucket = createBucket(objects);

  const snapshot = await loadStorefrontPublishedBootstrap(bucket, pointer);
  assert.deepEqual(snapshot.site.site.navigation.messageArticles, [
    {
      articleId: 'article-legacy',
      title: 'Legacy article',
      preview: 'Legacy preview',
      sortOrder: 0,
    },
  ]);
});

"""
replace_once(bootstrap, legacy_marker, legacy_test + legacy_marker)

storefront = "apps/storefront/test/messages-articles.test.mjs"
replace_once(
    storefront,
    """import assert from 'node:assert/strict';\nimport test from 'node:test';\n""",
    """import assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\nimport test from 'node:test';\n""",
)
replace_once(
    storefront,
    """        preview: 'Second',\n        sortOrder: 20,\n        body: '# Full Markdown must not escape bootstrap metadata',\n""",
    """        preview: 'Second',\n        backgroundObjectKey: 'media/messages/beta.webp',\n        sortOrder: 20,\n        body: '# Full Markdown must not escape bootstrap metadata',\n""",
)
replace_once(
    storefront,
    """    { articleId: 'article-b', title: 'Beta', preview: 'Second', sortOrder: 20 },\n""",
    """    {\n      articleId: 'article-b',\n      title: 'Beta',\n      preview: 'Second',\n      backgroundObjectKey: 'media/messages/beta.webp',\n      sortOrder: 20,\n    },\n""",
)
replace_once(
    storefront,
    """      preview: 'Updated preview',\n      sortOrder: 999,\n""",
    """      preview: 'Updated preview',\n      backgroundObjectKey: 'media/messages/changed.webp',\n      sortOrder: 999,\n""",
)
storefront_end = r"""

test('background metadata introduces no media API or extra bootstrap fetch path', () => {
  const source = readFileSync(
    new URL('../src/messages-articles.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/u);
  assert.doesNotMatch(source, /\/api\/[^'"`]*media/iu);
  assert.match(source, /site:messages:read-articles/u);
});
"""
Path(storefront).write_text(Path(storefront).read_text().rstrip() + storefront_end + "\n")

migration_test = "apps/worker/test/message-article-migration.test.mjs"
text = Path(migration_test).read_text()
text = text.replace(
    """const migration = readFileSync(\n  new URL('../../../migrations/0031_message_article_references.sql', import.meta.url),\n  'utf8',\n);\n""",
    """const migration = readFileSync(\n  new URL('../../../migrations/0031_message_article_references.sql', import.meta.url),\n  'utf8',\n);\nconst presentationMigration = readFileSync(\n  new URL('../../../migrations/0032_message_article_background_media.sql', import.meta.url),\n  'utf8',\n);\n""",
    1,
)
if "presentationMigration" not in text:
    raise SystemExit("failed to patch migration test imports")
text = text.rstrip() + r"""

test('0032 adds a nullable background media placement reference without disturbing existing rows', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE media_assets (id TEXT PRIMARY KEY);
      CREATE TABLE faqs (id TEXT PRIMARY KEY, deleted_at TEXT);
    `);
    db.exec(migration);
    db.prepare('INSERT INTO faqs (id, deleted_at) VALUES (?, NULL)').run('article-a');
    db.prepare('INSERT INTO media_assets (id) VALUES (?)').run('media-a');
    db.prepare(
      `INSERT INTO message_article_references (
         article_id, sort_order, is_enabled, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?)`,
    ).run('article-a', 7, 1, NOW, NOW);

    db.exec(presentationMigration);

    const columns = db.prepare('PRAGMA table_info(message_article_references)').all();
    const background = columns.find((column) => column.name === 'background_media_id');
    assert.ok(background);
    assert.equal(background.notnull, 0);
    assert.deepEqual(
      db
        .prepare(
          'SELECT article_id, background_media_id, sort_order, is_enabled FROM message_article_references',
        )
        .get(),
      {
        article_id: 'article-a',
        background_media_id: null,
        sort_order: 7,
        is_enabled: 1,
      },
    );

    db.prepare(
      'UPDATE message_article_references SET background_media_id = ? WHERE article_id = ?',
    ).run('media-a', 'article-a');
    db.prepare('DELETE FROM media_assets WHERE id = ?').run('media-a');
    assert.equal(
      db
        .prepare(
          'SELECT background_media_id FROM message_article_references WHERE article_id = ?',
        )
        .get('article-a').background_media_id,
      null,
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM message_article_references').get().count,
      1,
    );
  } finally {
    db.close();
  }
});
""" + "\n"
Path(migration_test).write_text(text)
