export type MediaDeleteResult = {
  deletedIds: string[];
  deletedKeys: string[];
  deletedCount: number;
  freedBytes: number;
};

export type MediaDeleteBlocked = {
  id: string;
  reason: 'IN_USE' | 'SNAPSHOT_RETENTION' | 'NOT_FOUND' | 'REFERENCE_CHANGED';
};

type MediaDeleteRow = {
  id: string;
  object_key: string;
  byte_size: number;
  updated_at: string;
};

type MediaReferenceRow = MediaDeleteRow & {
  logo_count: number;
  hero_slide_count: number;
  section_icon_count: number;
  product_cover_count: number;
  product_gallery_count: number;
};

type SnapshotRow = { media_keys_json: string };

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function parseMediaKeys(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === 'string' && key.length > 0)
      : [];
  } catch {
    return [];
  }
}

async function protectedMediaKeys(db: D1Database): Promise<Set<string>> {
  const rows = (
    await db
      .prepare(
        `SELECT v.media_keys_json
         FROM publish_module_versions v
         JOIN publish_module_jobs j ON j.id = v.publish_job_id
         WHERE j.status = 'published'`,
      )
      .all<SnapshotRow>()
  ).results;
  return new Set(rows.flatMap((row) => parseMediaKeys(row.media_keys_json)));
}

async function referenceRows(db: D1Database, ids: string[]): Promise<MediaReferenceRow[]> {
  if (ids.length === 0) return [];
  return (
    await db
      .prepare(
        `SELECT
           ma.id,
           ma.object_key,
           ma.byte_size,
           ma.updated_at,
           (SELECT COUNT(*) FROM site_settings ss WHERE ss.logo_asset_id = ma.id) AS logo_count,
           (SELECT COUNT(*) FROM site_hero_slides hs WHERE hs.media_asset_id = ma.id) AS hero_slide_count,
           (SELECT COUNT(*) FROM sections s WHERE s.icon_asset_id = ma.id) AS section_icon_count,
           (SELECT COUNT(*) FROM products p WHERE p.cover_asset_id = ma.id) AS product_cover_count,
           (SELECT COUNT(*) FROM product_media pm WHERE pm.media_asset_id = ma.id) AS product_gallery_count
         FROM media_assets ma
         WHERE ma.id IN (${placeholders(ids.length)})
           AND ma.status = 'ready'
           AND ma.deleted_at IS NULL`,
      )
      .bind(...ids)
      .all<MediaReferenceRow>()
  ).results;
}

function hasReferences(row: MediaReferenceRow): boolean {
  return (
    row.logo_count +
    row.hero_slide_count +
    row.section_icon_count +
    row.product_cover_count +
    row.product_gallery_count > 0
  );
}

export async function deleteManagedMediaAssets(
  bucket: R2Bucket,
  db: D1Database,
  ids: string[],
  now: string,
): Promise<{ ok: true; result: MediaDeleteResult } | { ok: false; blocked: MediaDeleteBlocked }> {
  const uniqueIds = [...new Set(ids)];
  const rows = await referenceRows(db, uniqueIds);
  const rowById = new Map(rows.map((row) => [row.id, row]));

  for (const id of uniqueIds) {
    if (!rowById.has(id)) return { ok: false, blocked: { id, reason: 'NOT_FOUND' } };
  }

  const protectedKeys = await protectedMediaKeys(db);
  for (const row of rows) {
    if (hasReferences(row)) return { ok: false, blocked: { id: row.id, reason: 'IN_USE' } };
    if (protectedKeys.has(row.object_key)) {
      return { ok: false, blocked: { id: row.id, reason: 'SNAPSHOT_RETENTION' } };
    }
  }

  const markResults = await db.batch(
    rows.map((row) =>
      db
        .prepare(
          `UPDATE media_assets
           SET status = 'deleted', deleted_at = ?, updated_at = ?
           WHERE id = ?
             AND status = 'ready'
             AND deleted_at IS NULL
             AND updated_at = ?
             AND NOT EXISTS (SELECT 1 FROM site_settings ss WHERE ss.logo_asset_id = media_assets.id)
             AND NOT EXISTS (SELECT 1 FROM site_hero_slides hs WHERE hs.media_asset_id = media_assets.id)
             AND NOT EXISTS (SELECT 1 FROM sections s WHERE s.icon_asset_id = media_assets.id)
             AND NOT EXISTS (SELECT 1 FROM products p WHERE p.cover_asset_id = media_assets.id)
             AND NOT EXISTS (SELECT 1 FROM product_media pm WHERE pm.media_asset_id = media_assets.id)`,
        )
        .bind(now, now, row.id, row.updated_at),
    ),
  );

  const changedRows = rows.filter((_, index) => markResults[index]?.meta.changes === 1);
  if (changedRows.length !== rows.length) {
    if (changedRows.length > 0) {
      await db.batch(
        changedRows.map((row) =>
          db
            .prepare(
              `UPDATE media_assets
               SET status = 'ready', deleted_at = NULL, updated_at = ?
               WHERE id = ? AND updated_at = ? AND deleted_at = ?`,
            )
            .bind(row.updated_at, row.id, now, now),
        ),
      );
    }
    const failedIndex = markResults.findIndex((result) => result.meta.changes !== 1);
    return {
      ok: false,
      blocked: { id: rows[Math.max(0, failedIndex)]?.id ?? uniqueIds[0] ?? '', reason: 'REFERENCE_CHANGED' },
    };
  }

  try {
    await bucket.delete(rows.map((row) => row.object_key));
  } catch (error) {
    await db.batch(
      rows.map((row) =>
        db
          .prepare(
            `UPDATE media_assets
             SET status = 'ready', deleted_at = NULL, updated_at = ?
             WHERE id = ? AND updated_at = ? AND deleted_at = ?`,
          )
          .bind(row.updated_at, row.id, now, now),
      ),
    );
    throw error;
  }

  return {
    ok: true,
    result: {
      deletedIds: rows.map((row) => row.id),
      deletedKeys: rows.map((row) => row.object_key),
      deletedCount: rows.length,
      freedBytes: rows.reduce((total, row) => total + row.byte_size, 0),
    },
  };
}
