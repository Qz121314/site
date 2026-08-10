export type MediaFolder = {
  id: string;
  name: string;
  sortOrder: number;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
};

type MediaFolderRow = {
  id: string;
  name: string;
  sort_order: number;
  asset_count: number;
  created_at: string;
  updated_at: string;
};

function mapFolder(row: MediaFolderRow): MediaFolder {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    assetCount: row.asset_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeMediaFolderName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > 80) return null;
  return normalized;
}

const FOLDER_SELECT = `SELECT
  mf.id,
  mf.name,
  mf.sort_order,
  mf.created_at,
  mf.updated_at,
  COUNT(ma.id) AS asset_count
FROM media_folders mf
LEFT JOIN media_assets ma
  ON ma.folder_id = mf.id
 AND ma.status = 'ready'
 AND ma.deleted_at IS NULL`;

export async function listMediaFolders(db: D1Database): Promise<MediaFolder[]> {
  const rows = await db
    .prepare(
      `${FOLDER_SELECT} GROUP BY mf.id ORDER BY mf.sort_order ASC, lower(mf.name) ASC`,
    )
    .all<MediaFolderRow>();
  return rows.results.map(mapFolder);
}

export async function getMediaFolder(
  db: D1Database,
  id: string,
): Promise<MediaFolder | null> {
  const row = await db
    .prepare(`${FOLDER_SELECT} WHERE mf.id = ? GROUP BY mf.id`)
    .bind(id)
    .first<MediaFolderRow>();
  return row ? mapFolder(row) : null;
}

export async function findMediaFolderByName(
  db: D1Database,
  name: string,
): Promise<MediaFolder | null> {
  const row = await db
    .prepare(
      `${FOLDER_SELECT} WHERE lower(trim(mf.name)) = lower(trim(?)) GROUP BY mf.id`,
    )
    .bind(name)
    .first<MediaFolderRow>();
  return row ? mapFolder(row) : null;
}

export async function ensureMediaFolder(
  db: D1Database,
  name: string,
  now: string,
): Promise<{ folder: MediaFolder; reused: boolean }> {
  const existing = await findMediaFolderByName(db, name);
  if (existing) return { folder: existing, reused: true };

  const id = crypto.randomUUID();
  const maxRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -10) AS max_order FROM media_folders')
    .first<{ max_order: number }>();
  const sortOrder = Math.max(0, (maxRow?.max_order ?? -10) + 10);

  try {
    await db
      .prepare(
        `INSERT INTO media_folders (id, name, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, name, sortOrder, now, now)
      .run();
  } catch {
    const raced = await findMediaFolderByName(db, name);
    if (raced) return { folder: raced, reused: true };
    throw new Error('MEDIA_FOLDER_CREATE_FAILED');
  }

  const created = await getMediaFolder(db, id);
  if (!created) throw new Error('MEDIA_FOLDER_CREATE_READ_FAILED');
  return { folder: created, reused: false };
}

export async function renameMediaFolder(
  db: D1Database,
  id: string,
  name: string,
  now: string,
): Promise<MediaFolder | null> {
  const result = await db
    .prepare('UPDATE media_folders SET name = ?, updated_at = ? WHERE id = ?')
    .bind(name, now, id)
    .run();
  if (result.meta.changes !== 1) return null;
  return getMediaFolder(db, id);
}

export async function deleteMediaFolder(
  db: D1Database,
  id: string,
  now: string,
): Promise<boolean> {
  const folder = await getMediaFolder(db, id);
  if (!folder) return false;
  await db.batch([
    db
      .prepare(
        'UPDATE media_assets SET folder_id = NULL, updated_at = ? WHERE folder_id = ?',
      )
      .bind(now, id),
    db.prepare('DELETE FROM media_folders WHERE id = ?').bind(id),
  ]);
  return true;
}

export async function moveMediaAssetsToFolder(
  db: D1Database,
  ids: string[],
  folderId: string | null,
  now: string,
): Promise<number> {
  if (ids.length === 0) return 0;
  if (folderId && !(await getMediaFolder(db, folderId))) return -1;
  const placeholders = ids.map(() => '?').join(', ');
  const result = await db
    .prepare(
      `UPDATE media_assets
       SET folder_id = ?, updated_at = ?
       WHERE id IN (${placeholders})
         AND status = 'ready'
         AND deleted_at IS NULL`,
    )
    .bind(folderId, now, ...ids)
    .run();
  return result.meta.changes;
}
