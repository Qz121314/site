import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCleanupCandidates } from '../src/assets/asset-library.ts';

const NOW = '2026-08-07T00:00:00.000Z';

function mediaRow({ key = 'media/old.webp', references = {}, id = 'media-1' } = {}) {
  return {
    id,
    object_key: key,
    status: 'ready',
    deleted_at: null,
    updated_at: NOW,
    logo_count: references.logo ?? 0,
    section_icon_count: references.sectionIcon ?? 0,
    product_cover_count: references.productCover ?? 0,
    product_gallery_count: references.productGallery ?? 0,
  };
}

function createAssetDb({ rows = [], retainedVersions = [], guards = [] } = {}) {
  const rowMap = new Map(rows.map((row) => [row.object_key, row]));
  const guardMap = new Map(guards.map((guard) => [guard.object_key, { ...guard }]));
  const batches = [];

  return {
    guardMap,
    batches,
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async all() {
          if (this.sql.includes('FROM media_assets ma')) {
            return { results: this.args.map((key) => rowMap.get(key)).filter(Boolean) };
          }
          if (this.sql.includes('FROM publish_versions')) {
            return {
              results: retainedVersions.map((content_version) => ({ content_version })),
            };
          }
          if (this.sql.includes('FROM asset_cleanup_guards')) {
            return { results: this.args.map((key) => guardMap.get(key)).filter(Boolean) };
          }
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
      return statement;
    },
    async batch(statements) {
      batches.push(
        statements.map((statement) => ({ sql: statement.sql, args: statement.args })),
      );
      for (const statement of statements) {
        if (statement.sql.includes('INSERT INTO asset_cleanup_guards')) {
          const [objectKey, mediaAssetId, guardContentVersion, firstSeenAt] =
            statement.args;
          if (!guardMap.has(objectKey)) {
            guardMap.set(objectKey, {
              object_key: objectKey,
              media_asset_id: mediaAssetId,
              guard_content_version: guardContentVersion,
              first_seen_at: firstSeenAt,
            });
          }
        } else if (statement.sql.includes('DELETE FROM asset_cleanup_guards')) {
          guardMap.delete(statement.args[0]);
        }
      }
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

function createBucket(objects) {
  const objectMap = new Map(objects.map((object) => [object.key, object]));
  return {
    async head(key) {
      return objectMap.get(key) ?? null;
    },
  };
}

function r2Object(key, contentType = 'image/webp') {
  return {
    key,
    size: 100,
    etag: `etag-${key}`,
    uploaded: new Date(NOW),
    httpMetadata: { contentType },
  };
}

test('an unused D1 media asset becomes snapshot-protected while the current retained version can still reference it', async () => {
  const row = mediaRow();
  const db = createAssetDb({
    rows: [row],
    retainedVersions: ['version-current', 'version-previous'],
  });
  const bucket = createBucket([r2Object(row.object_key)]);

  const [evaluation] = await evaluateCleanupCandidates(bucket, db, [row.object_key]);

  assert.equal(evaluation.referenceCount, 0);
  assert.equal(evaluation.blockedReason, 'SNAPSHOT_RETENTION');
  assert.equal(db.guardMap.get(row.object_key)?.guard_content_version, 'version-current');
  assert.equal(db.batches.length, 1);
});

test('snapshot protection expires naturally after the guard version leaves the retained-version window', async () => {
  const row = mediaRow();
  const db = createAssetDb({
    rows: [row],
    retainedVersions: ['version-new-3', 'version-new-2', 'version-new-1'],
    guards: [
      {
        object_key: row.object_key,
        media_asset_id: row.id,
        guard_content_version: 'version-old',
        first_seen_at: NOW,
      },
    ],
  });
  const bucket = createBucket([r2Object(row.object_key)]);

  const [evaluation] = await evaluateCleanupCandidates(bucket, db, [row.object_key]);

  assert.equal(evaluation.referenceCount, 0);
  assert.equal(evaluation.blockedReason, null);
  assert.equal(db.guardMap.get(row.object_key)?.guard_content_version, 'version-old');
});

test('a live D1 reference takes precedence and clears a stale snapshot cleanup guard', async () => {
  const row = mediaRow({ references: { productCover: 1 } });
  const db = createAssetDb({
    rows: [row],
    retainedVersions: ['version-current'],
    guards: [
      {
        object_key: row.object_key,
        media_asset_id: row.id,
        guard_content_version: 'version-current',
        first_seen_at: NOW,
      },
    ],
  });
  const bucket = createBucket([r2Object(row.object_key)]);

  const [evaluation] = await evaluateCleanupCandidates(bucket, db, [row.object_key]);

  assert.equal(evaluation.referenceCount, 1);
  assert.equal(evaluation.blockedReason, 'IN_USE');
  assert.equal(db.guardMap.has(row.object_key), false);
});

test('non-image R2 objects are never eligible for media cleanup even when D1 has no reference', async () => {
  const key = 'private/config.json';
  const db = createAssetDb({ retainedVersions: ['version-current'] });
  const bucket = createBucket([r2Object(key, 'application/json')]);

  const [evaluation] = await evaluateCleanupCandidates(bucket, db, [key]);

  assert.equal(evaluation.row, null);
  assert.equal(evaluation.referenceCount, 0);
  assert.equal(evaluation.blockedReason, 'NOT_IMAGE');
});

test('an untracked image object with no D1 media record is cleanup-eligible and cannot receive a false snapshot guard', async () => {
  const key = 'uploads/orphan.webp';
  const db = createAssetDb({ retainedVersions: ['version-current'] });
  const bucket = createBucket([r2Object(key)]);

  const [evaluation] = await evaluateCleanupCandidates(bucket, db, [key]);

  assert.equal(evaluation.row, null);
  assert.equal(evaluation.blockedReason, null);
  assert.equal(db.guardMap.size, 0);
});
