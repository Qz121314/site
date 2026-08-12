import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePublishModuleKey,
  readModularPointer,
  rollbackModularModule,
} from '../src/publishing/modular-publisher.ts';
import { publicStorefrontConfigRoutes } from '../src/routes/public-storefront-config.ts';

const SITE = {
  contentVersion: '20260807090000-site12345678-acde0001',
  manifestKey: 'public/modules/site/20260807090000-site12345678-acde0001/manifest.json',
  sourceRevision: 'site-source',
  publishedAt: '2026-08-07T09:00:00.000Z',
};
const INDEX = {
  contentVersion: '20260807090100-index1234567-acde0002',
  manifestKey:
    'public/modules/sections-index/20260807090100-index1234567-acde0002/manifest.json',
  sourceRevision: 'index-source',
  publishedAt: '2026-08-07T09:01:00.000Z',
};
const FAQ = {
  contentVersion: '20260807090200-faq123456789-acde0003',
  manifestKey: 'public/modules/faq/20260807090200-faq123456789-acde0003/manifest.json',
  sourceRevision: 'faq-source',
  publishedAt: '2026-08-07T09:02:00.000Z',
};
const SECTION_A = {
  contentVersion: '20260807090300-sectiona12345-acde0004',
  manifestKey:
    'public/modules/sections/section-a/20260807090300-sectiona12345-acde0004/manifest.json',
  sourceRevision: 'section-a-source-current',
  publishedAt: '2026-08-07T09:03:00.000Z',
};
const SECTION_B = {
  contentVersion: '20260807090400-sectionb12345-acde0005',
  manifestKey:
    'public/modules/sections/section-b/20260807090400-sectionb12345-acde0005/manifest.json',
  sourceRevision: 'section-b-source',
  publishedAt: '2026-08-07T09:04:00.000Z',
};
const SECTION_A_TARGET = {
  content_version: '20260807085000-sectionaold12-acde9999',
  module_key: 'section:section-a',
  source_revision: 'section-a-source-old',
  object_count: 4,
  total_bytes: 1234,
  is_current: 0,
  published_at: '2026-08-07T08:50:00.000Z',
  manifest_key:
    'public/modules/sections/section-a/20260807085000-sectionaold12-acde9999/manifest.json',
};

const POINTER = {
  schemaVersion: 2,
  contentVersion: '20260807090500-pointer-feed0001',
  publishedAt: '2026-08-07T09:05:00.000Z',
  site: SITE,
  sectionsIndex: INDEX,
  faq: FAQ,
  sections: {
    'section-a': SECTION_A,
    'section-b': SECTION_B,
  },
};

function createBucket({ pointer = POINTER, manifestExists = true } = {}) {
  const objects = new Map();
  if (pointer) objects.set('public/current.json', JSON.stringify(pointer));
  if (manifestExists) objects.set(SECTION_A_TARGET.manifest_key, '{}');
  const writes = [];
  return {
    objects,
    writes,
    async get(key) {
      const body = objects.get(key);
      if (body === undefined) return null;
      return {
        async text() {
          return body;
        },
      };
    },
    async head(key) {
      return objects.has(key) ? { key } : null;
    },
    async put(key, body, options) {
      const text = String(body);
      objects.set(key, text);
      writes.push({ key, body: text, options });
      return { key };
    },
  };
}

function createRollbackDb({ failBatch = false } = {}) {
  const batches = [];
  return {
    batches,
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (this.sql.includes('FROM publish_module_versions v'))
            return SECTION_A_TARGET;
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
      };
    },
    async batch(statements) {
      batches.push(
        statements.map((statement) => ({ sql: statement.sql, args: statement.args })),
      );
      if (failBatch) throw new Error('D1 modular rollback failed');
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

test('module-key validation permits the supported independent publication units only', () => {
  assert.equal(normalizePublishModuleKey(undefined), 'all');
  assert.equal(normalizePublishModuleKey('all'), 'all');
  assert.equal(normalizePublishModuleKey('site'), 'site');
  assert.equal(normalizePublishModuleKey('sections-index'), 'sections-index');
  assert.equal(normalizePublishModuleKey('faq'), 'faq');
  assert.equal(normalizePublishModuleKey('section:section-a'), 'section:section-a');
  assert.equal(normalizePublishModuleKey('section:'), null);
  assert.equal(normalizePublishModuleKey('section:not valid'), null);
  assert.equal(normalizePublishModuleKey('products'), null);
});

test('modular pointer reader distinguishes the legacy pointer from a valid schema-v2 composite pointer', async () => {
  const legacyBucket = createBucket({
    pointer: {
      schemaVersion: 1,
      contentVersion: '20260807070000-legacy123456-acde0000',
      manifestKey: 'public/versions/legacy/manifest.json',
      sourceRevision: 'legacy-source',
      publishedAt: '2026-08-07T07:00:00.000Z',
    },
  });
  const legacy = await readModularPointer(legacyBucket);
  assert.equal(legacy.pointer, null);
  assert.equal(legacy.legacyDetected, true);

  const modularBucket = createBucket();
  const modular = await readModularPointer(modularBucket);
  assert.deepEqual(modular.pointer, POINTER);
  assert.equal(modular.legacyDetected, false);
});

test('rolling back one business section changes only that section reference in the composite pointer', async () => {
  const bucket = createBucket();
  const db = createRollbackDb();

  const version = await rollbackModularModule(
    db,
    bucket,
    'section:section-a',
    SECTION_A_TARGET.content_version,
    'request-1',
  );

  assert.equal(version.moduleKey, 'section:section-a');
  assert.equal(version.contentVersion, SECTION_A_TARGET.content_version);
  assert.equal(version.isCurrent, true);

  const pointer = JSON.parse(bucket.objects.get('public/current.json'));
  assert.equal(
    pointer.sections['section-a'].contentVersion,
    SECTION_A_TARGET.content_version,
  );
  assert.deepEqual(pointer.sections['section-b'], SECTION_B);
  assert.deepEqual(pointer.site, SITE);
  assert.deepEqual(pointer.sectionsIndex, INDEX);
  assert.deepEqual(pointer.faq, FAQ);
  assert.notEqual(pointer.contentVersion, POINTER.contentVersion);

  assert.equal(db.batches.length, 1);
  const moduleScopedReset = db.batches[0].find((statement) =>
    statement.sql.includes('SET is_current = 0'),
  );
  assert.deepEqual(moduleScopedReset.args, ['section:section-a']);
  const audit = db.batches[0].find((statement) =>
    statement.sql.includes('INSERT INTO audit_logs'),
  );
  assert.ok(audit);
  assert.ok(
    audit.args.some(
      (arg) => typeof arg === 'string' && arg.includes(SECTION_A.contentVersion),
    ),
  );
  assert.ok(
    audit.args.some(
      (arg) => typeof arg === 'string' && arg.includes(SECTION_A_TARGET.content_version),
    ),
  );
});

test('modular rollback restores the entire previous composite pointer when the D1 transition fails', async () => {
  const bucket = createBucket();
  const db = createRollbackDb({ failBatch: true });

  await assert.rejects(
    () =>
      rollbackModularModule(
        db,
        bucket,
        'section:section-a',
        SECTION_A_TARGET.content_version,
        'request-2',
      ),
    /D1 modular rollback failed/,
  );

  assert.deepEqual(JSON.parse(bucket.objects.get('public/current.json')), POINTER);
  assert.equal(bucket.writes.length, 2);
  assert.equal(bucket.writes[1].body, JSON.stringify(POINTER));
});

test('modular rollback refuses a version whose retained R2 manifest is missing', async () => {
  const bucket = createBucket({ manifestExists: false });
  const db = createRollbackDb();

  await assert.rejects(
    () =>
      rollbackModularModule(
        db,
        bucket,
        'section:section-a',
        SECTION_A_TARGET.content_version,
        'request-3',
      ),
    (error) => error?.code === 'PUBLISH_VERSION_OBJECTS_MISSING',
  );

  assert.deepEqual(JSON.parse(bucket.objects.get('public/current.json')), POINTER);
  assert.equal(bucket.writes.length, 0);
  assert.equal(db.batches.length, 0);
});

test('public storefront discovery returns the current admin-configured R2 domain from D1', async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /SELECT media_base_url FROM site_settings/u);
      return {
        async first() {
          return { media_base_url: 'https://media.example.com' };
        },
      };
    },
  };

  const response = await publicStorefrontConfigRoutes.request(
    'https://storefront.example.com/media-base-url',
    {},
    { DB: db },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mediaBaseUrl: 'https://media.example.com' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('public storefront discovery reports an unconfigured R2 domain without inventing a default', async () => {
  const db = {
    prepare() {
      return {
        async first() {
          return { media_base_url: null };
        },
      };
    },
  };

  const response = await publicStorefrontConfigRoutes.request(
    'https://storefront.example.com/media-base-url',
    {},
    { DB: db },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mediaBaseUrl: null });
});

test('public storefront bootstrap consolidates the critical published snapshots', async () => {
  const bucket = createBucket();
  const site = { schemaVersion: 2, site: { name: 'Example' } };
  const sectionsIndex = { schemaVersion: 2, sections: [] };
  const home = { schemaVersion: 2, featuredProducts: [] };
  bucket.objects.set(
    SITE.manifestKey.replace(/manifest\.json$/u, 'site.json'),
    JSON.stringify(site),
  );
  bucket.objects.set(
    INDEX.manifestKey.replace(/manifest\.json$/u, 'sections.json'),
    JSON.stringify(sectionsIndex),
  );
  bucket.objects.set(
    `public/home/${POINTER.contentVersion}/home.json`,
    JSON.stringify(home),
  );
  const db = {
    prepare(sql) {
      assert.match(sql, /SELECT media_base_url FROM site_settings/u);
      return {
        async first() {
          return { media_base_url: 'https://media.example.com' };
        },
      };
    },
  };

  const response = await publicStorefrontConfigRoutes.request(
    'https://storefront.example.com/bootstrap',
    {},
    { DB: db, ASSETS_BUCKET: bucket },
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('cache-control'),
    'public, max-age=30, must-revalidate',
  );
  assert.deepEqual(await response.json(), {
    pointer: POINTER,
    site,
    sectionsIndex,
    home,
    mediaBaseUrl: 'https://media.example.com',
  });
});
