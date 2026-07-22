export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 512 * 1024;
export const MAX_THUMBNAIL_DIMENSION = 1024;
export const MAX_UPLOAD_REQUEST_BYTES = MAX_IMAGE_BYTES + MAX_THUMBNAIL_BYTES + 512 * 1024;
export const MAX_IMAGE_DIMENSION = 12_000;

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export type InspectedImage = {
  mimeType: SupportedImageType;
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
};

function readUint16BigEndian(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function hasAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset + value.length > bytes.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function validDimensions(width: number, height: number): boolean {
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_IMAGE_DIMENSION &&
    height <= MAX_IMAGE_DIMENSION
  );
}

function inspectPng(bytes: Uint8Array): InspectedImage | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  if (!hasAscii(bytes, 12, "IHDR")) return null;

  const width = readUint32BigEndian(bytes, 16);
  const height = readUint32BigEndian(bytes, 20);
  return validDimensions(width, height) ? { mimeType: "image/png", extension: "png", width, height } : null;
}

function inspectJpeg(bytes: Uint8Array): InspectedImage | null {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;

    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) return null;
      const height = readUint16BigEndian(bytes, offset + 3);
      const width = readUint16BigEndian(bytes, offset + 5);
      return validDimensions(width, height)
        ? { mimeType: "image/jpeg", extension: "jpg", width, height }
        : null;
    }

    offset += segmentLength;
  }

  return null;
}

function inspectWebp(bytes: Uint8Array): InspectedImage | null {
  if (bytes.length < 30 || !hasAscii(bytes, 0, "RIFF") || !hasAscii(bytes, 8, "WEBP")) return null;

  let width = 0;
  let height = 0;

  if (hasAscii(bytes, 12, "VP8X")) {
    width = readUint24LittleEndian(bytes, 24) + 1;
    height = readUint24LittleEndian(bytes, 27) + 1;
  } else if (hasAscii(bytes, 12, "VP8L") && bytes[20] === 0x2f) {
    const byte1 = bytes[21] ?? 0;
    const byte2 = bytes[22] ?? 0;
    const byte3 = bytes[23] ?? 0;
    const byte4 = bytes[24] ?? 0;
    width = 1 + (((byte2 & 0x3f) << 8) | byte1);
    height = 1 + (((byte4 & 0x0f) << 10) | (byte3 << 2) | ((byte2 & 0xc0) >> 6));
  } else if (
    hasAscii(bytes, 12, "VP8 ") &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    width = readUint16LittleEndian(bytes, 26) & 0x3fff;
    height = readUint16LittleEndian(bytes, 28) & 0x3fff;
  }

  return validDimensions(width, height) ? { mimeType: "image/webp", extension: "webp", width, height } : null;
}

export function inspectImage(bytes: Uint8Array, declaredType: string): InspectedImage | null {
  const inspected = inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes);
  if (!inspected) return null;

  const normalizedDeclaredType = declaredType.trim().toLowerCase();
  if (normalizedDeclaredType && normalizedDeclaredType !== inspected.mimeType) return null;
  return inspected;
}

export function normalizeOriginalName(value: string): string {
  const withoutPath = value.replaceAll("\\", "/").split("/").pop() ?? "image";
  const normalized = withoutPath
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return (normalized || "image").slice(0, 180);
}

export function createImageObjectKey(extension: InspectedImage["extension"], now = new Date()): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `images/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

export function createImageThumbnailObjectKey(now = new Date()): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `images/${year}/${month}/thumbnails/${crypto.randomUUID()}.webp`;
}

export function isSupportedImageType(value: string): value is SupportedImageType {
  return SUPPORTED_IMAGE_TYPES.includes(value as SupportedImageType);
}
