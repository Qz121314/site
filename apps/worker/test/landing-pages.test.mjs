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
import app from '../src/index.ts';
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from '../src/auth/session.ts';

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
  assert.match(source, /public\/landing-publications\/v1/u);
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

function routeDb() {
  const state = {
    products: new Map([
      [
        'product-a',
        {
          status: 'published',
          deleted_at: null,
          section_deleted_at: null,
          section_enabled: 1,
        },
      ],
      [
        'product-draft',
        {
          status: 'draft',
          deleted_at: null,
          section_deleted_at: null,
          section_enabled: 1,
        },
      ],
    ]),
    assets: new Map([
      [
        'ready-image',
        { id: 'ready-image', status: 'ready', deleted_at: null, mime_type: 'image/jpeg' },
      ],
      [
        'deleted-image',
        {
          id: 'deleted-image',
          status: 'ready',
          deleted_at: 'deleted',
          mime_type: 'image/jpeg',
        },
      ],
      [
        'pending-image',
        {
          id: 'pending-image',
          status: 'pending',
          deleted_at: null,
          mime_type: 'image/jpeg',
        },
      ],
      [
        'ready-video',
        { id: 'ready-video', status: 'ready', deleted_at: null, mime_type: 'video/mp4' },
      ],
    ]),
    landings: new Map(),
  };
  return {
    state,
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          if (sql.includes('FROM landing_pages')) {
            const row = state.landings.get(args[0]);
            return row ? { ...row } : null;
          }
          if (sql.includes('SELECT p.id,p.status')) {
            const product = state.products.get(args[0]);
            return product ? { id: args[0], ...product } : null;
          }
          if (sql.includes('FROM media_assets')) {
            const asset = state.assets.get(args[0]);
            return asset &&
              asset.status === 'ready' &&
              asset.deleted_at === null &&
              asset.mime_type.startsWith('image/')
              ? { id: asset.id }
              : null;
          }
          return null;
        },
        async all() {
          return {
            results: [...state.landings.values()]
              .filter((row) =>
                sql.includes('deleted_at IS NOT NULL')
                  ? row.deleted_at !== null
                  : !sql.includes('deleted_at IS NULL') || row.deleted_at === null,
              )
              .map((row) => ({ ...row })),
          };
        },
        async run() {
          if (sql.includes('INSERT INTO landing_pages')) {
            if (
              [...state.landings.values()].some(
                (row) => row.slug === args[2] && row.deleted_at === null,
              )
            )
              throw new Error(
                'UNIQUE constraint failed: landing_pages_active_slug_unique',
              );
            const [
              id,
              name,
              slug,
              product_id,
              template_key,
              chat_template_key,
              headline_override,
              subheadline_override,
              hero_asset_id,
              cta_label_override,
              chat_welcome_override,
              status,
              published_at,
              created_at,
              updated_at,
              deleted_at,
            ] = args;
            state.landings.set(id, {
              id,
              name,
              slug,
              product_id,
              template_key,
              chat_template_key,
              headline_override,
              subheadline_override,
              hero_asset_id,
              cta_label_override,
              chat_welcome_override,
              status,
              published_at,
              created_at,
              updated_at,
              deleted_at,
            });
          } else if (sql.includes('UPDATE landing_pages SET name=')) {
            const [
              name,
              slug,
              product_id,
              template_key,
              chat_template_key,
              headline_override,
              subheadline_override,
              hero_asset_id,
              cta_label_override,
              chat_welcome_override,
              status,
              published_at,
              updated_at,
              id,
            ] = args;
            if (
              [...state.landings.values()].some(
                (row) => row.id !== id && row.slug === slug && row.deleted_at === null,
              )
            )
              throw new Error(
                'UNIQUE constraint failed: landing_pages_active_slug_unique',
              );
            Object.assign(state.landings.get(id), {
              name,
              slug,
              product_id,
              template_key,
              chat_template_key,
              headline_override,
              subheadline_override,
              hero_asset_id,
              cta_label_override,
              chat_welcome_override,
              status,
              published_at,
              updated_at,
            });
          } else if (sql.includes("SET status='archived'")) {
            const [deleted_at, updated_at, id] = args;
            Object.assign(state.landings.get(id), {
              status: 'archived',
              deleted_at,
              updated_at,
            });
          } else if (sql.includes("SET status='draft'")) {
            const [updated_at, id] = args;
            Object.assign(state.landings.get(id), {
              status: 'draft',
              deleted_at: null,
              published_at: null,
              updated_at,
            });
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };
}

async function adminCookie() {
  const { token } = await createAdminSessionToken('test-secret', Date.now());
  return `${ADMIN_SESSION_COOKIE}=${token}`;
}

async function routeRequest(db, path, method, body, headers = {}) {
  return app.request(
    `https://example.test${path}`,
    {
      method,
      headers: {
        cookie: await adminCookie(),
        ...(method !== 'GET' ? { 'x-admin-request': '1' } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    {
      DB: db,
      SESSION_SECRET: 'test-secret',
      ADMIN_PASSWORD: 'password',
      ASSETS_BUCKET: {},
      ASSETS: {},
      ENVIRONMENT: 'test',
      APP_VERSION: 'test',
    },
  );
}

test('Landing Admin routes perform authenticated CRUD, soft delete, restore, validation, and conflict handling', async () => {
  const db = routeDb();
  const body = input({
    name: 'Route Landing',
    slug: 'route-landing',
    productId: 'product-a',
  });
  const missingMarker = await routeRequest(db, '/api/admin/landings/', 'POST', body, {
    'x-admin-request': '0',
  });
  assert.equal(missingMarker.status, 403);
  const createdResponse = await routeRequest(db, '/api/admin/landings/', 'POST', body);
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).landing;
  const listResponse = await routeRequest(db, '/api/admin/landings/', 'GET');
  assert.equal((await listResponse.json()).landings.length, 1);
  const detailResponse = await routeRequest(
    db,
    `/api/admin/landings/${created.id}`,
    'GET',
  );
  assert.equal((await detailResponse.json()).landing.slug, 'route-landing');
  const updateResponse = await routeRequest(
    db,
    `/api/admin/landings/${created.id}`,
    'PUT',
    { ...body, name: 'Updated Landing', slug: 'updated-landing' },
  );
  assert.equal((await updateResponse.json()).landing.name, 'Updated Landing');
  const invalidProduct = await routeRequest(db, '/api/admin/landings/', 'POST', {
    ...body,
    slug: 'invalid-product',
    productId: 'missing',
  });
  assert.equal(invalidProduct.status, 409);
  const duplicate = await routeRequest(db, '/api/admin/landings/', 'POST', {
    ...body,
    name: 'Duplicate',
    slug: 'updated-landing',
  });
  assert.equal(duplicate.status, 409);
  const deletedResponse = await routeRequest(
    db,
    `/api/admin/landings/${created.id}`,
    'DELETE',
  );
  assert.equal((await deletedResponse.json()).landing.deletedAt !== null, true);
  const restoredResponse = await routeRequest(
    db,
    `/api/admin/landings/${created.id}/restore`,
    'POST',
    undefined,
    { 'x-admin-request': '1' },
  );
  assert.equal((await restoredResponse.json()).landing.status, 'draft');
  const notFound = await routeRequest(db, '/api/admin/landings/missing', 'GET');
  assert.equal(notFound.status, 404);
});

test('Landing Admin route keeps Hero validation specific to ready image assets', async () => {
  for (const [assetId, expected] of [
    ['ready-image', 201],
    ['deleted-image', 409],
    ['pending-image', 409],
    ['ready-video', 409],
  ]) {
    const response = await routeRequest(
      routeDb(),
      '/api/admin/landings/',
      'POST',
      input({
        name: assetId,
        slug: `hero-${assetId}`,
        status: 'published',
        heroAssetId: assetId,
      }),
    );
    assert.equal(response.status, expected, assetId);
  }
});
