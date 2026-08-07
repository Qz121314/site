import assert from 'node:assert/strict';
import test from 'node:test';
import { rollbackStorefrontVersion } from '../src/publishing/publish-state.ts';

const TARGET = {
  content_version: 'version-b',
  publish_job_id: 'job-b',
  manifest_key: 'public/versions/version-b/manifest.json',
  source_revision: 'source-b',
  state_revision: 'state-b',
  object_count: 12,
  total_bytes: 3456,
  is_current: 0,
  published_at: '2026-08-07T01:00:00.000Z',
};

const PREVIOUS_POINTER = {
  schemaVersion: 1,
  contentVersion: 'version-a',
  manifestKey: 'public/versions/version-a/manifest.json',
  sourceRevision: 'source-a',
  publishedAt: '2026-08-07T00:00:00.000Z',
};

function createBucket({ manifestExists = true, pointer = PREVIOUS_POINTER } = {}) {
  const objects = new Map();
  if (pointer) objects.set('public/current.json', JSON.stringify(pointer));
  if (manifestExists) objects.set(TARGET.manifest_key, '{}');
  const writes = [];
  const deletes = [];

  return {
    objects,
    writes,
    deletes,
    async get(key) {
      const body = objects.get(key);
      if (body === undefined) return null;
      return { async text() { return body; } };
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
    async delete(key) {
      objects.delete(key);
      deletes.push(key);
    },
  };
}

function createDb({ target = TARGET, failBatch = false } = {}) {
  const prepared = [];
  const batches = [];
  return {
    prepared,
    batches,
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          prepared.push({ kind: 'first', sql: this.sql, args: this.args });
          if (this.sql.includes('FROM publish_versions pv')) return target;
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
      };
      prepared.push({ kind: 'prepare', sql, statement });
      return statement;
    },
    async batch(statements) {
      batches.push(statements.map((statement) => ({ sql: statement.sql, args: statement.args })));
      if (failBatch) throw new Error('D1 batch failed');
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

test('rollback switches public/current.json lastingly and updates D1 current-version state', async () => {
  const bucket = createBucket();
  const db = createDb();

  const version = await rollbackStorefrontVersion(db, bucket, 'version-b', 'request-1');

  assert.equal(version.contentVersion, 'version-b');
  assert.equal(version.isCurrent, true);
  const pointer = JSON.parse(bucket.objects.get('public/current.json'));
  assert.deepEqual(pointer, {
    schemaVersion: 1,
    contentVersion: 'version-b',
    manifestKey: TARGET.manifest_key,
    sourceRevision: 'source-b',
    publishedAt: TARGET.published_at,
  });
  assert.equal(bucket.writes.length, 1);
  assert.equal(bucket.writes[0].options.httpMetadata.cacheControl, 'public, max-age=30, must-revalidate');
  assert.equal(db.batches.length, 1);
  assert.ok(db.batches[0].some((statement) => statement.sql.includes('SET is_current = 0')));
  assert.ok(db.batches[0].some((statement) => statement.sql.includes('SET is_current = 1')));
  const audit = db.batches[0].find((statement) => statement.sql.includes('INSERT INTO audit_logs'));
  assert.ok(audit);
  assert.ok(audit.args.some((arg) => typeof arg === 'string' && arg.includes('version-a')));
  assert.ok(audit.args.some((arg) => typeof arg === 'string' && arg.includes('version-b')));
});

test('rollback restores the previous R2 pointer if the D1 state transition fails', async () => {
  const bucket = createBucket();
  const db = createDb({ failBatch: true });

  await assert.rejects(
    () => rollbackStorefrontVersion(db, bucket, 'version-b', 'request-2'),
    /D1 batch failed/,
  );

  assert.deepEqual(JSON.parse(bucket.objects.get('public/current.json')), PREVIOUS_POINTER);
  assert.equal(bucket.writes.length, 2);
  assert.equal(bucket.writes[0].key, 'public/current.json');
  assert.equal(bucket.writes[1].body, JSON.stringify(PREVIOUS_POINTER));
});

test('rollback removes a newly-created pointer when there was no previous pointer and D1 fails', async () => {
  const bucket = createBucket({ pointer: null });
  const db = createDb({ failBatch: true });

  await assert.rejects(
    () => rollbackStorefrontVersion(db, bucket, 'version-b', 'request-3'),
    /D1 batch failed/,
  );

  assert.equal(bucket.objects.has('public/current.json'), false);
  assert.deepEqual(bucket.deletes, ['public/current.json']);
});

test('rollback refuses a retained D1 version whose R2 manifest is missing', async () => {
  const bucket = createBucket({ manifestExists: false });
  const db = createDb();

  await assert.rejects(
    () => rollbackStorefrontVersion(db, bucket, 'version-b', 'request-4'),
    (error) => error?.code === 'PUBLISH_VERSION_OBJECTS_MISSING',
  );

  assert.deepEqual(JSON.parse(bucket.objects.get('public/current.json')), PREVIOUS_POINTER);
  assert.equal(bucket.writes.length, 0);
  assert.equal(db.batches.length, 0);
});

test('rolling back to the already-current version is a no-op', async () => {
  const bucket = createBucket();
  const db = createDb({ target: { ...TARGET, is_current: 1 } });

  const version = await rollbackStorefrontVersion(db, bucket, 'version-b', 'request-5');

  assert.equal(version.isCurrent, true);
  assert.equal(bucket.writes.length, 0);
  assert.equal(db.batches.length, 0);
});
