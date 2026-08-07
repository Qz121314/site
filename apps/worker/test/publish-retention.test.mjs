import assert from 'node:assert/strict';
import test from 'node:test';
import { prunePublishRetention } from '../src/publishing/publish-retention.ts';

function createRetentionDb({ publishedRows, allVersions, completedJobs }) {
  const deletedVersions = [];
  const deletedJobs = [];

  return {
    deletedVersions,
    deletedJobs,
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async all() {
          if (this.sql.includes('FROM publish_versions pv') && this.sql.includes('JOIN publish_jobs')) {
            return { results: publishedRows };
          }
          if (this.sql === 'SELECT content_version FROM publish_versions') {
            return { results: allVersions.map((content_version) => ({ content_version })) };
          }
          if (this.sql.includes('FROM publish_jobs') && this.sql.includes("status NOT IN ('queued', 'building')")) {
            return { results: completedJobs.map((id) => ({ id })) };
          }
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        if (statement.sql.includes('DELETE FROM publish_versions')) {
          deletedVersions.push(statement.args[0]);
        } else if (statement.sql.includes('DELETE FROM publish_jobs')) {
          deletedJobs.push(statement.args[0]);
        } else {
          throw new Error(`Unexpected batch SQL: ${statement.sql}`);
        }
      }
      return statements.map(() => ({ success: true }));
    },
  };
}

function createBucket(keys, pageSize = 1000) {
  const deleted = [];
  return {
    deleted,
    async list({ prefix, cursor }) {
      assert.equal(prefix, 'public/versions/');
      const start = cursor ? Number(cursor) : 0;
      const pageKeys = keys.slice(start, start + pageSize);
      const next = start + pageKeys.length;
      return {
        objects: pageKeys.map((key) => ({ key })),
        truncated: next < keys.length,
        cursor: next < keys.length ? String(next) : undefined,
      };
    },
    async delete(value) {
      deleted.push(...(Array.isArray(value) ? value : [value]));
    },
  };
}

test('retention protects current version and keeps exactly three successful snapshots', async () => {
  const db = createRetentionDb({
    publishedRows: [
      { content_version: 'v2-current', publish_job_id: 'j2', published_at: '2026-08-02T00:00:00Z' },
      { content_version: 'v4', publish_job_id: 'j4', published_at: '2026-08-04T00:00:00Z' },
      { content_version: 'v3', publish_job_id: 'j3', published_at: '2026-08-03T00:00:00Z' },
      { content_version: 'v1', publish_job_id: 'j1', published_at: '2026-08-01T00:00:00Z' },
    ],
    allVersions: ['v1', 'v2-current', 'v3', 'v4'],
    completedJobs: ['failed-new', 'j4', 'j3', 'j2', 'j1'],
  });
  const bucket = createBucket([
    'public/versions/v1/site.json',
    'public/versions/v2-current/site.json',
    'public/versions/v3/site.json',
    'public/versions/v4/site.json',
    'public/versions/orphan/partial.json',
  ], 2);

  const result = await prunePublishRetention(db, bucket);

  assert.deepEqual(result.retainedVersions, ['v2-current', 'v4', 'v3']);
  assert.equal(result.removedVersionRecords, 1);
  assert.deepEqual(db.deletedVersions, ['v1']);
  assert.deepEqual(new Set(bucket.deleted), new Set([
    'public/versions/v1/site.json',
    'public/versions/orphan/partial.json',
  ]));
  assert.equal(result.removedR2Objects, 2);
  assert.deepEqual(new Set(db.deletedJobs), new Set(['failed-new', 'j1']));
  assert.equal(result.removedJobRecords, 2);
});

test('when fewer than three snapshots exist, completed job history fills the remaining slots only', async () => {
  const db = createRetentionDb({
    publishedRows: [
      { content_version: 'v2', publish_job_id: 'j2', published_at: '2026-08-02T00:00:00Z' },
      { content_version: 'v1', publish_job_id: 'j1', published_at: '2026-08-01T00:00:00Z' },
    ],
    allVersions: ['v1', 'v2'],
    completedJobs: ['failed-latest', 'j2', 'failed-old', 'j1'],
  });
  const bucket = createBucket([
    'public/versions/v1/site.json',
    'public/versions/v2/site.json',
  ]);

  const result = await prunePublishRetention(db, bucket);

  assert.deepEqual(result.retainedVersions, ['v2', 'v1']);
  assert.deepEqual(db.deletedJobs, ['failed-old']);
  assert.equal(result.removedJobRecords, 1);
  assert.equal(result.removedVersionRecords, 0);
  assert.equal(result.removedR2Objects, 0);
});

test('objects outside public/versions are never considered for snapshot cleanup', async () => {
  const db = createRetentionDb({
    publishedRows: [],
    allVersions: [],
    completedJobs: [],
  });
  const bucket = createBucket([
    'uploads/products/a.webp',
    'public/current.json',
    'public/versions/orphan/site.json',
  ]);

  const result = await prunePublishRetention(db, bucket);

  assert.deepEqual(bucket.deleted, ['public/versions/orphan/site.json']);
  assert.equal(result.removedR2Objects, 1);
});
