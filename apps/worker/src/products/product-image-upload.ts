import { buildAssetPublicUrl, getMediaBaseUrl } from '../assets/asset-library';
import type { ProductMediaRecord } from './products';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_EDGE = 200;
const MAX_IMAGE_EDGE = 8000;

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
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

export type ProductImageUploadResult =
  | { ok: true; media: ProductMediaRecord; reused: boolean }
  | { ok: false; field: 'file'; code: string; message: string };

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

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    ascii(bytes, 1, 3) !== 'PNG' ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return null;
  }
  return { width: uint32Big(bytes, 16), height: uint32Big(bytes, 20) };
}

function readGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null;
  const signature = ascii(bytes, 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
  return { width: uint16Little(bytes, 6), height: uint16Little(bytes, 8) };
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
      return { width: uint16Big(bytes, offset + 5), height: uint16Big(bytes, offset + 3) };
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    return {
      width: uint24Little(bytes, 24) + 1,
      height: uint24Little(bytes, 27) + 1,
    };
  }
  if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
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

function readDimensions(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } | null {
  switch (mimeType) {
    case 'image/png':
      return readPngDimensions(bytes);
    case 'image/jpeg':
      return readJpegDimensions(bytes);
    case 'image/webp':
      return readWebpDimensions(bytes);
    case 'image/gif':
      return readGifDimensions(bytes);
    default:
      return null;
  }
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/[\\/\0]/g, '-').replace(/\s+/g, ' ');
  return normalized.slice(0, 180) || 'product-image';
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toMedia(row: MediaAssetRow, mediaBaseUrl: string | null): ProductMediaRecord {
  return {
    id: row.id,
    objectKey: row.object_key,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    sortOrder: 0,
    altText: null,
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

export async function uploadProductImage(
  bucket: R2Bucket,
  db: D1Database,
  sectionId: string,
  file: File,
): Promise<ProductImageUploadResult> {
  const mimeType = file.type.toLowerCase();
  const extension = MIME_EXTENSION[mimeType];
  if (!extension) {
    return {
      ok: false,
      field: 'file',
      code: 'IMAGE_TYPE_UNSUPPORTED',
      message: '产品图片仅支持 JPG、PNG、WebP 或 GIF。',
    };
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      field: 'file',
      code: 'IMAGE_SIZE_INVALID',
      message: '产品图片必须小于或等于 10 MB。',
    };
  }

  const data = await file.arrayBuffer();
  const dimensions = readDimensions(new Uint8Array(data), mimeType);
  if (!dimensions) {
    return {
      ok: false,
      field: 'file',
      code: 'IMAGE_CONTENT_INVALID',
      message: '无法识别图片内容或尺寸，文件可能已损坏。',
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
  if (existing) {
    return { ok: true, media: toMedia(existing, mediaBaseUrl), reused: true };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const date = now.slice(0, 7).replace('-', '/');
  const objectKey = `products/${sectionId}/${date}/${id}.${extension}`;
  const fileName = sanitizeFileName(file.name);

  await bucket.put(objectKey, data, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      purpose: 'product-image',
      sectionId,
      mediaAssetId: id,
      width: String(dimensions.width),
      height: String(dimensions.height),
    },
  });

  const row: MediaAssetRow = {
    id,
    object_key: objectKey,
    file_name: fileName,
    mime_type: mimeType,
    byte_size: file.size,
    width: dimensions.width,
    height: dimensions.height,
  };

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
    if (raced) {
      return { ok: true, media: toMedia(raced, mediaBaseUrl), reused: true };
    }
    throw error;
  }

  return { ok: true, media: toMedia(row, mediaBaseUrl), reused: false };
}
