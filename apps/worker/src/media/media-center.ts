import { buildAssetPublicUrl, getMediaBaseUrl } from '../assets/asset-library';
import { getMediaFolder } from './media-folders';

export type MediaKind = 'image' | 'animated_image' | 'video';
export type MediaRole =
  | 'general'
  | 'product'
  | 'logo'
  | 'icon'
  | 'favicon'
  | 'hero'
  | 'background'
  | 'content';

export type MediaCenterAsset = {
  id: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  mediaKind: MediaKind;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  folderId: string | null;
  folderName: string | null;
  roles: MediaRole[];
  publicUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaUploadResult =
  | { ok: true; media: MediaCenterAsset; reused: boolean }
  | { ok: false; field: 'file' | 'role' | 'folderId'; code: string; message: string };

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_IMAGE_EDGE = 12_000;
const MAX_STATIC_IMAGE_EDGE = 1200;
const MIN_IMAGE_EDGE = 16;

const MEDIA_TYPES: Record<string, { extension: string; kind: MediaKind }> = {
  'image/jpeg': { extension: 'jpg', kind: 'image' },
  'image/png': { extension: 'png', kind: 'image' },
  'image/webp': { extension: 'webp', kind: 'image' },
  'image/gif': { extension: 'gif', kind: 'animated_image' },
  'video/mp4': { extension: 'mp4', kind: 'video' },
  'video/webm': { extension: 'webm', kind: 'video' },
};

const MEDIA_ROLES = new Set<MediaRole>([
  'general',
  'product',
  'logo',
  'icon',
  'favicon',
  'hero',
  'background',
  'content',
]);

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

function uint16Little(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function uint16Big(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function uint24Little(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function uint32Big(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! * 0x1000000 +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  );
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function readImageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } | null {
  if (mimeType === 'image/png') {
    if (bytes.length < 24 || bytes[0] !== 0x89 || ascii(bytes, 1, 3) !== 'PNG') return null;
    return { width: uint32Big(bytes, 16), height: uint32Big(bytes, 20) };
  }

  if (mimeType === 'image/gif') {
    if (bytes.length < 10) return null;
    const signature = ascii(bytes, 0, 6);
    if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
    return { width: uint16Little(bytes, 6), height: uint16Little(bytes, 8) };
  }

  if (mimeType === 'image/jpeg') {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1]!;
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) return null;
      const segmentLength = uint16Big(bytes, offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
      const frame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (frame && segmentLength >= 7) {
        return { width: uint16Big(bytes, offset + 5), height: uint16Big(bytes, offset + 3) };
      }
      offset += segmentLength;
    }
    return null;
  }

  if (mimeType === 'image/webp') {
    if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
      return null;
    }
    const chunk = ascii(bytes, 12, 4);
    if (chunk === 'VP8X') {
      return { width: uint24Little(bytes, 24) + 1, height: uint24Little(bytes, 27) + 1 };
    }
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: uint16Little(bytes, 26) & 0x3fff, height: uint16Little(bytes, 28) & 0x3fff };
    }
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      const b1 = bytes[21]!;
      const b2 = bytes[22]!;
      const b3 = bytes[23]!;
      const b4 = bytes[24]!;
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    }
  }

  return null;
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/[\\/\0]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
  return normalized || 'media';
}

function safeObjectName(value: string): string {
  const normalized = sanitizeFileName(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized || 'media';
}

function fileStem(value: string): string {
  return value.replace(/\.[^.]+$/, '');
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readOptionalMetric(value: FormDataEntryValue | null, max: number): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

export function parseMediaRole(value: unknown): MediaRole | null {
  return typeof value === 'string' && MEDIA_ROLES.has(value as MediaRole) ? (value as MediaRole) : null;
}

function rolesMap(rows: RoleRow[]): Map<string, MediaRole[]> {
  const map = new Map<string, MediaRole[]>();
  rows.forEach((row) => {
    const current = map.get(row.media_asset_id) ?? [];
    current.push(row.role);
    map.set(row.media_asset_id, current);
  });
  return map;
}

function mapMedia(row: MediaRow, roles: MediaRole[], mediaBaseUrl: string | null): MediaCenterAsset {
  return {
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
    roles,
    publicUrl: buildAssetPublicUrl(mediaBaseUrl, row.object_key),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

async function getMediaRow(db: D1Database, id: string): Promise<MediaRow | null> {
  return db
    .prepare(
      `${MEDIA_SELECT}
       WHERE ma.id = ? AND ma.status = 'ready' AND ma.deleted_at IS NULL`,
    )
    .bind(id)
    .first<MediaRow>();
}

async function addRole(db: D1Database, id: string, role: MediaRole, now: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO media_asset_roles (media_asset_id, role, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(media_asset_id, role) DO NOTHING`,
    )
    .bind(id, role, now)
    .run();
}

async function findImageByHash(db: D1Database, hash: string): Promise<MediaRow | null> {
  return db
    .prepare(
      `${MEDIA_SELECT}
       WHERE ma.content_hash = ? AND ma.status = 'ready' AND ma.deleted_at IS NULL`,
    )
    .bind(hash)
    .first<MediaRow>();
}

export async function listMediaCenterAssets(
  db: D1Database,
  options: { kind?: MediaKind | null; role?: MediaRole | null; folderId?: string | null } = {},
): Promise<MediaCenterAsset[]> {
  const clauses = ["ma.status = 'ready'", 'ma.deleted_at IS NULL'];
  const bindings: string[] = [];
  if (options.kind) {
    clauses.push('ma.media_kind = ?');
    bindings.push(options.kind);
  }
  if (options.role) {
    clauses.push('EXISTS (SELECT 1 FROM media_asset_roles rf WHERE rf.media_asset_id = ma.id AND rf.role = ?)');
    bindings.push(options.role);
  }
  if (options.folderId) {
    clauses.push('ma.folder_id = ?');
    bindings.push(options.folderId);
  }

  const rows = (
    await db
      .prepare(
        `${MEDIA_SELECT}
         WHERE ${clauses.join(' AND ')}
         ORDER BY ma.created_at DESC
         LIMIT 1000`,
      )
      .bind(...bindings)
      .all<MediaRow>()
  ).results;
  const roleRows = await getRoleRows(db, rows.map((row) => row.id));
  const roleById = rolesMap(roleRows);
  const mediaBaseUrl = await getMediaBaseUrl(db);
  return rows.map((row) => mapMedia(row, roleById.get(row.id) ?? [], mediaBaseUrl));
}

export async function getMediaCenterAsset(db: D1Database, id: string): Promise<MediaCenterAsset | null> {
  const row = await getMediaRow(db, id);
  if (!row) return null;
  const roles = rolesMap(await getRoleRows(db, [id])).get(id) ?? [];
  return mapMedia(row, roles, await getMediaBaseUrl(db));
}

export async function uploadMediaCenterAsset(
  bucket: R2Bucket,
  db: D1Database,
  formData: FormData,
): Promise<MediaUploadResult> {
  const file = formData.get('file');
  const role = parseMediaRole(formData.get('role'));
  const rawFolderId = formData.get('folderId');
  const folderId = typeof rawFolderId === 'string' && rawFolderId.trim() ? rawFolderId.trim() : null;
  if (!(file instanceof File)) {
    return { ok: false, field: 'file', code: 'MEDIA_FILE_REQUIRED', message: '请选择需要上传的素材文件。' };
  }
  if (!role) {
    return { ok: false, field: 'role', code: 'MEDIA_ROLE_INVALID', message: '请选择素材用途。' };
  }
  if (folderId && (folderId.length > 100 || !(await getMediaFolder(db, folderId)))) {
    return { ok: false, field: 'folderId', code: 'MEDIA_FOLDER_INVALID', message: '所选素材文件夹不存在。' };
  }

  const type = MEDIA_TYPES[file.type.toLowerCase()];
  if (!type) {
    return {
      ok: false,
      field: 'file',
      code: 'MEDIA_TYPE_UNSUPPORTED',
      message: '支持 JPG、PNG、WebP、GIF、MP4 和 WebM。',
    };
  }
  const limit = type.kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size <= 0 || file.size > limit) {
    return {
      ok: false,
      field: 'file',
      code: 'MEDIA_SIZE_INVALID',
      message: type.kind === 'video' ? '视频素材不能超过 60 MB。' : '图片或 GIF 不能超过 20 MB。',
    };
  }

  let width = readOptionalMetric(formData.get('width'), MAX_IMAGE_EDGE);
  let height = readOptionalMetric(formData.get('height'), MAX_IMAGE_EDGE);
  const durationMs = type.kind === 'video' ? readOptionalMetric(formData.get('durationMs'), 24 * 60 * 60 * 1000) : null;
  let imageData: ArrayBuffer | null = null;
  let contentHash: string | null = null;

  if (type.kind !== 'video') {
    imageData = await file.arrayBuffer();
    const dimensions = readImageDimensions(new Uint8Array(imageData), file.type.toLowerCase());
    if (!dimensions) {
      return { ok: false, field: 'file', code: 'MEDIA_CONTENT_INVALID', message: '无法识别图片或 GIF 内容。' };
    }
    const maximumEdge = type.kind === 'image' ? MAX_STATIC_IMAGE_EDGE : MAX_IMAGE_EDGE;
    if (
      dimensions.width < MIN_IMAGE_EDGE ||
      dimensions.height < MIN_IMAGE_EDGE ||
      dimensions.width > maximumEdge ||
      dimensions.height > maximumEdge
    ) {
      return {
        ok: false,
        field: 'file',
        code: 'MEDIA_DIMENSIONS_INVALID',
        message: type.kind === 'image'
          ? `压缩后的静态图片最长边不能超过 ${MAX_STATIC_IMAGE_EDGE} 像素。`
          : '图片宽高必须在 16 到 12000 像素之间。',
      };
    }
    width = dimensions.width;
    height = dimensions.height;
    contentHash = toHex(await crypto.subtle.digest('SHA-256', imageData));
    const existing = await findImageByHash(db, contentHash);
    if (existing) {
      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare('UPDATE media_assets SET folder_id = COALESCE(?, folder_id), updated_at = ? WHERE id = ?')
          .bind(folderId, now, existing.id),
        db
          .prepare(
            `INSERT INTO media_asset_roles (media_asset_id, role, created_at)
             VALUES (?, ?, ?)
             ON CONFLICT(media_asset_id, role) DO NOTHING`,
          )
          .bind(existing.id, role, now),
      ]);
      const media = await getMediaCenterAsset(db, existing.id);
      if (!media) throw new Error('MEDIA_REUSE_READ_FAILED');
      return { ok: true, media, reused: true };
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const safeName = safeObjectName(fileStem(file.name));
  const storageVariant = type.kind === 'image' ? 'optimized' : 'media';
  const objectKey = `media/${id}/${storageVariant}/${safeName}.${type.extension}`;
  const fileName = sanitizeFileName(file.name);
  const compressionProfile = formData.get('compressionProfile');
  const sourceByteSize = formData.get('sourceByteSize');

  await bucket.put(objectKey, imageData ?? file.stream(), {
    httpMetadata: {
      contentType: file.type.toLowerCase(),
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      mediaAssetId: id,
      mediaKind: type.kind,
      role,
      ...(folderId ? { folderId } : {}),
      ...(typeof compressionProfile === 'string' && compressionProfile
        ? { compressionProfile }
        : {}),
      ...(typeof sourceByteSize === 'string' && sourceByteSize
        ? { sourceByteSize }
        : {}),
    },
  });

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO media_assets (
             id, object_key, file_name, mime_type, byte_size, width, height,
             content_hash, status, created_at, updated_at, deleted_at, media_kind, duration_ms,
             folder_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, NULL, ?, ?, ?)`,
        )
        .bind(
          id,
          objectKey,
          fileName,
          file.type.toLowerCase(),
          file.size,
          width,
          height,
          contentHash,
          now,
          now,
          type.kind,
          durationMs,
          folderId,
        ),
      db
        .prepare(
          `INSERT INTO media_asset_roles (media_asset_id, role, created_at)
           VALUES (?, ?, ?)`,
        )
        .bind(id, role, now),
    ]);
  } catch (error) {
    await bucket.delete(objectKey);
    if (contentHash) {
      const raced = await findImageByHash(db, contentHash);
      if (raced) {
        await addRole(db, raced.id, role, now);
        if (folderId) {
          await db.prepare('UPDATE media_assets SET folder_id = ?, updated_at = ? WHERE id = ?').bind(folderId, now, raced.id).run();
        }
        const media = await getMediaCenterAsset(db, raced.id);
        if (media) return { ok: true, media, reused: true };
      }
    }
    throw error;
  }

  const media = await getMediaCenterAsset(db, id);
  if (!media) throw new Error('MEDIA_UPLOAD_READ_FAILED');
  return { ok: true, media, reused: false };
}
