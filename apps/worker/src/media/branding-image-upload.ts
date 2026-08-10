import { buildAssetPublicUrl, getMediaBaseUrl } from '../assets/asset-library';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_IMAGE_EDGE = 48;
const MAX_IMAGE_EDGE = 1600;

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export type BrandingImageKind = 'logo' | 'section-icon';

export type BrandingMediaRecord = {
  id: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  publicUrl: string | null;
};

type MediaAssetRow = {
  id: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
};

export type BrandingImageUploadResult =
  | { ok: true; media: BrandingMediaRecord; reused: boolean }
  | { ok: false; field: 'file' | 'kind'; code: string; message: string };

function uint16Little(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function uint16Big(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function uint24Little(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
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
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && segmentLength >= 7) {
      return {
        width: uint16Big(bytes, offset + 5),
        height: uint16Big(bytes, offset + 3),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== 'RIFF' ||
    ascii(bytes, 8, 4) !== 'WEBP'
  ) {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    return { width: uint24Little(bytes, 24) + 1, height: uint24Little(bytes, 27) + 1 };
  }
  if (
    chunk === 'VP8 ' &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      width: uint16Little(bytes, 26) & 0x3fff,
      height: uint16Little(bytes, 28) & 0x3fff,
    };
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
  return null;
}

function readDimensions(bytes: Uint8Array, mimeType: string) {
  return mimeType === 'image/jpeg'
    ? readJpegDimensions(bytes)
    : readWebpDimensions(bytes);
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/\0]/g, '-')
    .replace(/\s+/g, ' ');
  return normalized.slice(0, 180) || 'branding-image';
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function toMedia(row: MediaAssetRow, mediaBaseUrl: string | null): BrandingMediaRecord {
  return {
    id: row.id,
    objectKey: row.object_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width ?? 0,
    height: row.height ?? 0,
    publicUrl: buildAssetPublicUrl(mediaBaseUrl, row.object_key),
  };
}

async function findByHash(db: D1Database, hash: string): Promise<MediaAssetRow | null> {
  return db
    .prepare(
      `SELECT id, object_key, file_name, mime_type, byte_size, width, height
       FROM media_assets
       WHERE content_hash = ? AND status = 'ready' AND deleted_at IS NULL`,
    )
    .bind(hash)
    .first<MediaAssetRow>();
}

export async function uploadBrandingImage(
  bucket: R2Bucket,
  db: D1Database,
  kind: BrandingImageKind,
  file: File,
): Promise<BrandingImageUploadResult> {
  if (kind !== 'logo' && kind !== 'section-icon') {
    return {
      ok: false,
      field: 'kind',
      code: 'BRANDING_KIND_INVALID',
      message: '图片用途无效。',
    };
  }

  const mimeType = file.type.toLowerCase();
  const extension = MIME_EXTENSION[mimeType];
  if (!extension) {
    return {
      ok: false,
      field: 'file',
      code: 'IMAGE_TYPE_UNSUPPORTED',
      message: 'Logo 和分区图标只接收浏览器压缩后的 WebP 或 JPEG。',
    };
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      field: 'file',
      code: 'IMAGE_SIZE_INVALID',
      message: '压缩后的图片必须小于或等于 5 MB。',
    };
  }

  const data = await file.arrayBuffer();
  const dimensions = readDimensions(new Uint8Array(data), mimeType);
  if (!dimensions) {
    return {
      ok: false,
      field: 'file',
      code: 'IMAGE_CONTENT_INVALID',
      message: '无法识别压缩图片的真实内容或尺寸。',
    };
  }
  if (
    dimensions.width < MIN_IMAGE_EDGE ||
    dimensions.height < MIN_IMAGE_EDGE ||
    dimensions.width > MAX_IMAGE_EDGE ||
    dimensions.height > MAX_IMAGE_EDGE
  ) {
    return {
      ok: false,
      field: 'file',
      code: 'IMAGE_DIMENSIONS_INVALID',
      message: `图片宽高必须在 ${MIN_IMAGE_EDGE} 到 ${MAX_IMAGE_EDGE} 像素之间。`,
    };
  }

  const hash = toHex(await crypto.subtle.digest('SHA-256', data));
  const mediaBaseUrl = await getMediaBaseUrl(db);
  const existing = await findByHash(db, hash);
  if (existing) return { ok: true, media: toMedia(existing, mediaBaseUrl), reused: true };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const date = now.slice(0, 7).replace('-', '/');
  const folder = kind === 'logo' ? 'logos' : 'section-icons';
  const objectKey = `branding/${folder}/${date}/${id}.${extension}`;
  const row: MediaAssetRow = {
    id,
    object_key: objectKey,
    file_name: sanitizeFileName(file.name),
    mime_type: mimeType,
    byte_size: file.size,
    width: dimensions.width,
    height: dimensions.height,
  };

  await bucket.put(objectKey, data, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      purpose: 'branding-image',
      brandingKind: kind,
      mediaAssetId: id,
      width: String(dimensions.width),
      height: String(dimensions.height),
    },
  });

  try {
    await db
      .prepare(
        `INSERT INTO media_assets (
           id, object_key, file_name, mime_type, byte_size, width, height,
           content_hash, status, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, NULL)`,
      )
      .bind(
        row.id,
        row.object_key,
        row.file_name,
        row.mime_type,
        row.byte_size,
        row.width,
        row.height,
        hash,
        now,
        now,
      )
      .run();
  } catch (error) {
    await bucket.delete(objectKey);
    const raced = await findByHash(db, hash);
    if (raced) return { ok: true, media: toMedia(raced, mediaBaseUrl), reused: true };
    throw error;
  }

  return { ok: true, media: toMedia(row, mediaBaseUrl), reused: false };
}
