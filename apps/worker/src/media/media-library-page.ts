import { buildAssetPublicUrl, getMediaBaseUrl } from '../assets/asset-library';
import type { MediaCenterAsset, MediaKind, MediaRole } from './media-center';

type MediaRow = {
  id: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  media_kind: MediaKind;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  folder_id: string | null;
  folder_name: string | null;
  created_at: string;
  updated_at: string;
};

type RoleRow = {
  media_asset_id: string;
  role: MediaRole;
};

export type MediaLibraryPage = {
  assets: MediaCenterAsset[];
  nextCursor: string | null;
  total: number;
};

export type MediaLibraryPageOptions = {
  kinds?: MediaKind[];
  role?: MediaRole | null;
  folder?: 'all' | 'unfiled' | string;
  query?: string;
  cursor?: string | null;
  limit?: number;
};

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 100;

const MEDIA_SELECT = `SELECT
  ma.id,
  ma.object_key,
  ma.file_name,
  ma.mime_type,
  ma.byte_size,
  ma.media_kind,
  ma.width,
  ma.height,
  ma.duration_ms,
  ma.folder_id,
  mf.name AS folder_name,
  ma.created_at,
  ma.updated_at
FROM media_assets ma
LEFT JOIN media_folders mf ON mf.id = ma.folder_id`;

function normalizeLimit(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1) return DEFAULT_LIMIT;
  return Math.min(value ?? DEFAULT_LIMIT, MAX_LIMIT);
}

function encodeCursor(row: Pick<MediaRow, 'created_at' | 'id'>): string {
  return btoa(`${row.created_at}|${row.id}`)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeCursor(
  value: string | null | undefined,
): { createdAt: string; id: string } | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const separator = decoded.lastIndexOf('|');
    if (separator <= 0 || separator === decoded.length - 1) return null;
    const createdAt = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!createdAt || !id || id.length > 100) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function rolesMap(rows: RoleRow[]): Map<string, MediaRole[]> {
  const map = new Map<string, MediaRole[]>();
  for (const row of rows) {
    const current = map.get(row.media_asset_id) ?? [];
    current.push(row.role);
    map.set(row.media_asset_id, current);
  }
  return map;
}

async function getRoleRows(db: D1Database, ids: string[]): Promise<RoleRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return (
    await db
      .prepare(
        `SELECT media_asset_id, role
         FROM media_asset_roles
         WHERE media_asset_id IN (${placeholders})
         ORDER BY role ASC`,
      )
      .bind(...ids)
      .all<RoleRow>()
  ).results;
}

function buildFilters(options: MediaLibraryPageOptions): {
  clauses: string[];
  bindings: Array<string | number>;
} {
  const clauses = ["ma.status = 'ready'", 'ma.deleted_at IS NULL'];
  const bindings: Array<string | number> = [];

  const kinds = [...new Set(options.kinds ?? [])];
  if (kinds.length > 0) {
    clauses.push(`ma.media_kind IN (${kinds.map(() => '?').join(', ')})`);
    bindings.push(...kinds);
  }

  if (options.role) {
    clauses.push(
      'EXISTS (SELECT 1 FROM media_asset_roles rf WHERE rf.media_asset_id = ma.id AND rf.role = ?)',
    );
    bindings.push(options.role);
  }

  if (options.folder === 'unfiled') {
    clauses.push('ma.folder_id IS NULL');
  } else if (options.folder && options.folder !== 'all') {
    clauses.push('ma.folder_id = ?');
    bindings.push(options.folder);
  }

  const query = options.query?.trim().toLowerCase();
  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push(`(
      LOWER(ma.file_name) LIKE ? ESCAPE '\\'
      OR LOWER(ma.object_key) LIKE ? ESCAPE '\\'
      OR LOWER(ma.mime_type) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(mf.name, '')) LIKE ? ESCAPE '\\'
      OR EXISTS (
        SELECT 1 FROM media_asset_roles rq
        WHERE rq.media_asset_id = ma.id AND LOWER(rq.role) LIKE ? ESCAPE '\\'
      )
    )`);
    bindings.push(pattern, pattern, pattern, pattern, pattern);
  }

  return { clauses, bindings };
}

export async function listMediaLibraryPage(
  db: D1Database,
  options: MediaLibraryPageOptions = {},
): Promise<MediaLibraryPage> {
  const limit = normalizeLimit(options.limit);
  const filters = buildFilters(options);
  const cursor = decodeCursor(options.cursor);
  const pageClauses = [...filters.clauses];
  const pageBindings = [...filters.bindings];

  if (cursor) {
    pageClauses.push('(ma.created_at < ? OR (ma.created_at = ? AND ma.id < ?))');
    pageBindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  const rows = (
    await db
      .prepare(
        `${MEDIA_SELECT}
         WHERE ${pageClauses.join(' AND ')}
         ORDER BY ma.created_at DESC, ma.id DESC
         LIMIT ?`,
      )
      .bind(...pageBindings, limit + 1)
      .all<MediaRow>()
  ).results;

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const roleRows = await getRoleRows(
    db,
    pageRows.map((row) => row.id),
  );
  const roleById = rolesMap(roleRows);
  const mediaBaseUrl = await getMediaBaseUrl(db);

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM media_assets ma
       LEFT JOIN media_folders mf ON mf.id = ma.folder_id
       WHERE ${filters.clauses.join(' AND ')}`,
    )
    .bind(...filters.bindings)
    .first<{ count: number }>();

  const assets = pageRows.map<MediaCenterAsset>((row) => ({
    id: row.id,
    objectKey: row.object_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    mediaKind: row.media_kind,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    folderId: row.folder_id,
    folderName: row.folder_name,
    roles: roleById.get(row.id) ?? [],
    publicUrl: buildAssetPublicUrl(mediaBaseUrl, row.object_key),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const lastRow = pageRows.at(-1);
  return {
    assets,
    nextCursor: hasMore && lastRow ? encodeCursor(lastRow) : null,
    total: countRow?.count ?? assets.length,
  };
}
