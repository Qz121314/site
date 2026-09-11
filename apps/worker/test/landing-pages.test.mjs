import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLandingStatement,
  listLandings,
  normalizeLandingSlug,
  resolveLandingPresentation,
  updateLandingStatement,
  validateLandingDependencies,
  validateLandingInput,
} from '../src/landing/landing-pages.ts';
import { validateLandingPublication } from '../src/publishing/landing-publisher.ts';

function d1(db) {
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        first() {
          return Promise.resolve(db.prepare(sql).get(...args) ?? null);
        },
        all() {
          return Promise.resolve({ results: db.prepare(sql).all(...args) });
        },
        run() {
          return Promise.resolve(db.prepare(sql).run(...args));
        },
      };
    },
    batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };
}

function landingDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE landing_pages (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, product_id TEXT NOT NULL,
    template_key TEXT NOT NULL, chat_template_key TEXT NOT NULL, headline_override TEXT,
    subheadline_override TEXT, hero_asset_id TEXT, cta_label_override TEXT,
    chat_welcome_override TEXT, status TEXT NOT NULL, published_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  ); CREATE UNIQUE INDEX landing_slug ON landing_pages(slug) WHERE deleted_at IS NULL;`);
  return { db, api: d1(db) };
}

const input = (overrides = {}) => ({
  name: 'Summer',
  slug: ' Summer Offer! ',
  productId: 'product-a',
  templateKey: 'direct_response',
  chatTemplateKey: 'match_landing',
  headlineOverride: null,
  subheadlineOverride: null,
  heroAssetId: null,
  ctaLabelOverride: null,
  chatWelcomeOverride: null,
  status: 'draft',
  ...overrides,
});
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration = readFileSync(
  new URL('../../../migrations/0040_landing_pages.sql', import.meta.url),
  'utf8',
);

test('landing schema is independent, product-referencing, and does not restore H5', () => {
  assert.match(migration, /CREATE TABLE landing_pages/u);
  assert.match(migration, /product_id TEXT NOT NULL REFERENCES products\(id\)/u);
  assert.match(migration, /hero_asset_id TEXT REFERENCES media_assets\(id\)/u);
  assert.match(migration, /template_key TEXT NOT NULL DEFAULT 'direct_response'/u);
  assert.match(migration, /CHECK \(status IN \('draft', 'published', 'archived'\)\)/u);
  assert.doesNotMatch(migration, /h5_pages|presentation_mode|landing_media_copy/u);
});

test('landing publication contract keeps a separate namespaced static artifact', () => {
  const source = readFileSync(
    new URL('../src/publishing/landing-publisher.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /LANDING_PUBLICATION_SCHEMA_VERSION = 1/u);
  assert.match(source, /landing-publication\/v1/u);
  assert.match(source, /validateLandingPublication/u);
  assert.match(source, /buildLandingModel/u);
  assert.doesNotMatch(source, /is_visible\s*=\s*1/u);
});

test('landing slug and template contracts are finite and normalized', () => {
  const source = readFileSync(
    new URL('../src/landing/landing-pages.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /direct_response.*visual_story.*chat_first/su);
  assert.match(source, /replace\(\/\[\^a-z0-9\]/u);
  assert.match(source, /RESERVED_SLUGS/u);
});

test('landing CRUD persists normalized slugs and soft deletes without copying product data', async () => {
  const { db, api } = landingDb();
  try {
    const created = createLandingStatement(
      api,
      { ...input(), slug: normalizeLandingSlug(input().slug) },
      '2026-09-11T00:00:00.000Z',
    );
    await created.statement.run();
    assert.equal((await listLandings(api)).length, 1);
    await updateLandingStatement(
      api,
      created.landing.id,
      { ...input(), name: 'Updated', slug: 'updated', productId: 'product-a' },
      null,
      '2026-09-11T01:00:00.000Z',
    ).run();
    assert.equal((await listLandings(api))[0].name, 'Updated');
    db.prepare('UPDATE landing_pages SET deleted_at = ?, status = ? WHERE id = ?').run(
      '2026-09-11T02:00:00.000Z',
      'archived',
      created.landing.id,
    );
    assert.equal((await listLandings(api)).length, 0);
    assert.equal((await listLandings(api, 'trash')).length, 1);
  } finally {
    db.close();
  }
});

test('landing input normalizes, rejects reserved or duplicate slugs, and blocks unimplemented publish templates', async () => {
  assert.equal(normalizeLandingSlug('  Summer Offer / FB  '), 'summer-offer-fb');
  assert.equal(validateLandingInput(input({ slug: 'api' })).ok, false);
  assert.equal(
    validateLandingInput(input({ status: 'published', templateKey: 'visual_story' })).ok,
    false,
  );
  const { db, api } = landingDb();
  const first = createLandingStatement(api, { ...input(), slug: 'same' }, 'now');
  assert.equal(first.landing.slug, 'same');
  await first.statement.run();
  const duplicate = createLandingStatement(
    api,
    { ...input({ name: 'Second' }), slug: 'same' },
    'later',
  );
  assert.throws(() => duplicate.statement.run(), /UNIQUE/u);
  db.close();
});

test('landing dependency eligibility allows hidden published products and rejects product or section failures', async () => {
  const dbFor = ({
    status = 'published',
    deleted_at = null,
    section_deleted_at = null,
    section_enabled = 1,
    asset = true,
  } = {}) => ({
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        first: async () =>
          sql.includes('media_assets')
            ? asset
              ? { id: 'hero' }
              : null
            : {
                id: 'product-a',
                status,
                deleted_at,
                section_deleted_at,
                section_enabled,
              },
      };
    },
  });
  assert.equal(
    (await validateLandingDependencies(dbFor(), input({ status: 'published' }))).ok,
    true,
  );
  assert.equal(
    (
      await validateLandingDependencies(
        dbFor({ status: 'draft' }),
        input({ status: 'published' }),
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await validateLandingDependencies(
        dbFor({ status: 'archived' }),
        input({ status: 'published' }),
      )
    ).ok,
    false,
  );
  assert.equal(
    (await validateLandingDependencies(dbFor({ deleted_at: 'deleted' }), input())).ok,
    false,
  );
  assert.equal(
    (
      await validateLandingDependencies(
        dbFor({ section_deleted_at: 'deleted' }),
        input({ status: 'published' }),
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await validateLandingDependencies(
        dbFor({ section_enabled: 0 }),
        input({ status: 'published' }),
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await validateLandingDependencies(
        dbFor({ asset: false }),
        input({ heroAssetId: 'hero' }),
      )
    ).ok,
    false,
  );
});

test('landing override resolution keeps body separate and falls back to product cover', () => {
  const resolved = resolveLandingPresentation(
    input(),
    {
      title: 'Product',
      body: 'Long body',
      effectiveCoverAssetId: 'cover',
      buttonLabel: 'Contact',
    },
    null,
  );
  assert.deepEqual(resolved, {
    headline: 'Product',
    subheadline: null,
    body: 'Long body',
    heroAssetId: 'cover',
    heroAsset: null,
    ctaLabel: 'Contact',
  });
  const custom = resolveLandingPresentation(
    input({
      headlineOverride: 'Headline',
      subheadlineOverride: 'Sub',
      heroAssetId: 'hero',
      ctaLabelOverride: 'Buy',
    }),
    {
      title: 'Product',
      body: 'Long body',
      effectiveCoverAssetId: 'cover',
      buttonLabel: 'Contact',
    },
    {
      assetId: 'hero',
      objectKey: 'hero.jpg',
      publicUrl: 'https://cdn.test/hero.jpg',
      width: 1200,
      height: 800,
    },
  );
  assert.equal(custom.subheadline, 'Sub');
  assert.equal(custom.heroAsset.publicUrl, 'https://cdn.test/hero.jpg');
});

test('publication eligibility rejects archived/deleted landings and unimplemented templates before D1 dependency work', async () => {
  const landing = {
    ...input({ status: 'published' }),
    id: 'landing-a',
    publishedAt: 'now',
    createdAt: 'now',
    updatedAt: 'now',
    deletedAt: null,
  };
  const db = dbForPublication();
  assert.equal((await validateLandingPublication(db, landing)).ok, true);
  assert.equal(
    (await validateLandingPublication(db, { ...landing, templateKey: 'visual_story' }))
      .code,
    'LANDING_TEMPLATE_NOT_PUBLISHABLE',
  );
  assert.equal(
    (await validateLandingPublication(db, { ...landing, deletedAt: 'deleted' })).code,
    'LANDING_NOT_PUBLISHABLE',
  );
});

function dbForPublication() {
  return {
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        first: async () =>
          sql.includes('media_assets')
            ? null
            : {
                id: 'product-a',
                status: 'published',
                deleted_at: null,
                section_deleted_at: null,
                section_enabled: 1,
              },
      };
    },
  };
}
