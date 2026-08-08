const ACCEPTED_STATIC_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_SIDE = 1200;
const MIN_IMAGE_SIDE = 16;
const OUTPUT_QUALITY = 0.82;

export const MEDIA_IMAGE_COMPRESSION_PROFILE = 'browser-static-image-v1';

export type PreparedCompressedMediaImage = {
  file: File;
  width: number;
  height: number;
  sourceByteSize: number;
  compressionProfile: typeof MEDIA_IMAGE_COMPRESSION_PROFILE;
};

export function isCompressibleStaticMediaImage(file: File): boolean {
  return ACCEPTED_STATIC_IMAGE_TYPES.has(file.type.toLowerCase());
}

function safeBaseName(fileName: string): string {
  const normalized = fileName
    .replace(/\.[^.]+$/u, '')
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 90);
  return normalized || 'media-image';
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeCompressedImage(
  canvas: HTMLCanvasElement,
  baseName: string,
): Promise<File> {
  const webp = await canvasToBlob(canvas, 'image/webp', OUTPUT_QUALITY);
  if (webp && webp.type === 'image/webp' && webp.size > 0) {
    return new File([webp], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  }

  const jpegCanvas = document.createElement('canvas');
  jpegCanvas.width = canvas.width;
  jpegCanvas.height = canvas.height;
  const context = jpegCanvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('当前浏览器无法生成压缩图片。');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
  context.drawImage(canvas, 0, 0);
  const jpeg = await canvasToBlob(jpegCanvas, 'image/jpeg', OUTPUT_QUALITY);
  if (!jpeg || jpeg.size <= 0) throw new Error('浏览器图片压缩失败。');
  return new File([jpeg], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function prepareCompressedMediaImage(
  sourceFile: File,
): Promise<PreparedCompressedMediaImage> {
  if (!isCompressibleStaticMediaImage(sourceFile)) {
    throw new Error('静态图片压缩仅支持 JPG、PNG 或 WebP。');
  }
  if (sourceFile.size <= 0) throw new Error('图片文件为空。');
  if (sourceFile.size > MAX_SOURCE_BYTES) {
    throw new Error('本地原图不能超过 30 MB。');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(sourceFile);
  } catch {
    throw new Error(`无法读取图片“${sourceFile.name}”。`);
  }

  try {
    if (bitmap.width < MIN_IMAGE_SIDE || bitmap.height < MIN_IMAGE_SIDE) {
      throw new Error(`图片“${sourceFile.name}”的宽高都必须至少为 ${MIN_IMAGE_SIDE} 像素。`);
    }

    const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('当前浏览器无法创建图片压缩画布。');

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    const file = await encodeCompressedImage(
      canvas,
      `${safeBaseName(sourceFile.name)}-${crypto.randomUUID().slice(0, 8)}`,
    );
    if (file.size > MAX_OUTPUT_BYTES) {
      throw new Error(`图片“${sourceFile.name}”压缩后仍超过 20 MB，请先降低图片复杂度。`);
    }

    return {
      file,
      width,
      height,
      sourceByteSize: sourceFile.size,
      compressionProfile: MEDIA_IMAGE_COMPRESSION_PROFILE,
    };
  } finally {
    bitmap.close();
  }
}
