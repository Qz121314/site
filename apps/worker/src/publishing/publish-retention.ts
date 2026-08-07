const RETAINED_PUBLICATION_COUNT = 3;
const VERSION_PREFIX = 'public/versions/';
const R2_DELETE_BATCH_SIZE = 1000;

type PublishedVersionRow = {
  content_version: string;
  publish_job_id: string;
  published_at: string;
};

type PublishJobRow = {
  id: string;
};

export type PublishRetentionResult = {
  retainedVersions: string[];
  removedVersionRecords: number;
  removedJobRecords: number;
  removedR2Objects: number;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function listAllVersionObjectKeys(bucket: R2Bucket): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({
      prefix: VERSION_PREFIX,
      ...(cursor ? { cursor } : {}),
      limit: 1000,
    });
    keys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return keys;
}

function versionFromObjectKey(key: string): string | null {
  if (!key.startsWith(VERSION_PREFIX)) return null;
  const suffix = key.slice(VERSION_PREFIX.length);
  const separator = suffix.indexOf('/');
  if (separator <= 0) return null;
  return suffix.slice(0, separator);
}

async function pruneR2Snapshots(bucket: R2Bucket, retainedVersions: Set<string>): Promise<number> {
  const allKeys = await listAllVersionObjectKeys(bucket);
  const staleKeys = allKeys.filter((key) => {
    const version = versionFromObjectKey(key);
    return version !== null && !retainedVersions.has(version);
  });

  for (const batch of chunk(staleKeys, R2_DELETE_BATCH_SIZE)) {
    if (batch.length > 0) await bucket.delete(batch);
  }

  return staleKeys.length;
}

async function pruneVersionRecords(
  db: D1Database,
): Promise<{ retained: PublishedVersionRow[]; removed: number }> {
  const rows = (
    await db
      .prepare(
        `SELECT pv.content_version, pv.publish_job_id, pv.published_at
         FROM publish_versions pv
         JOIN publish_jobs pj ON pj.id = pv.publish_job_id
         WHERE pj.status = 'published'
         ORDER BY pv.is_current DESC, pv.published_at DESC, pv.content_version DESC`,
      )
      .all<PublishedVersionRow>()
  ).results;

  const retained = rows.slice(0, RETAINED_PUBLICATION_COUNT);
  const retainedVersions = new Set(retained.map((row) => row.content_version));

  const allVersionRows = (
    await db
      .prepare('SELECT content_version FROM publish_versions')
      .all<{ content_version: string }>()
  ).results;
  const staleVersions = allVersionRows
    .map((row) => row.content_version)
    .filter((version) => !retainedVersions.has(version));

  if (staleVersions.length > 0) {
    await db.batch(
      staleVersions.map((version) =>
        db.prepare('DELETE FROM publish_versions WHERE content_version = ?').bind(version),
      ),
    );
  }

  return { retained, removed: staleVersions.length };
}

async function pruneJobRecords(db: D1Database, retainedVersions: PublishedVersionRow[]): Promise<number> {
  const protectedJobIds = new Set(retainedVersions.map((row) => row.publish_job_id));
  const completedJobs = (
    await db
      .prepare(
        `SELECT id
         FROM publish_jobs
         WHERE status NOT IN ('queued', 'building')
         ORDER BY requested_at DESC, id DESC`,
      )
      .all<PublishJobRow>()
  ).results;

  const additionalSlots = Math.max(0, RETAINED_PUBLICATION_COUNT - protectedJobIds.size);
  const extraJobsToKeep = completedJobs
    .filter((job) => !protectedJobIds.has(job.id))
    .slice(0, additionalSlots);
  const keepIds = new Set([
    ...protectedJobIds,
    ...extraJobsToKeep.map((job) => job.id),
  ]);
  const staleJobIds = completedJobs.map((job) => job.id).filter((id) => !keepIds.has(id));

  if (staleJobIds.length > 0) {
    await db.batch(
      staleJobIds.map((id) => db.prepare('DELETE FROM publish_jobs WHERE id = ?').bind(id)),
    );
  }

  return staleJobIds.length;
}

export async function prunePublishRetention(
  db: D1Database,
  bucket: R2Bucket,
): Promise<PublishRetentionResult> {
  const versionResult = await pruneVersionRecords(db);
  const retainedVersions = new Set(versionResult.retained.map((row) => row.content_version));
  const [removedJobRecords, removedR2Objects] = await Promise.all([
    pruneJobRecords(db, versionResult.retained),
    pruneR2Snapshots(bucket, retainedVersions),
  ]);

  return {
    retainedVersions: versionResult.retained.map((row) => row.content_version),
    removedVersionRecords: versionResult.removed,
    removedJobRecords,
    removedR2Objects,
  };
}
