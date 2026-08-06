export type BrandingImageKind = 'logo' | 'section-icon';

export type LocalBrandingImage = {
  kind: BrandingImageKind;
  sourceFile: File;
  compressedFile: File;
  previewUrl: string;
  width: number;
  height: number;
  originalByteSize: number;
};

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MIN_EDGE = 48;
const QUALITY = 0.86;

function maximumSide(kind: BrandingImageKind): number {
  return kind === 'logo' ? 1200 : 512;
}

function safeBaseName(fileName: string): string {
  const value = fileName
    .replace(/\.[^.]+$/u, '')
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
  return value || 'branding-image';
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(canvas: HTMLCanvasElement, baseName: string): Promise<File> {
  const webp = await canvasToBlob(canvas, 'image/webp', QUALITY);
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
  const jpeg = await canvasToBlob(jpegCanvas, 'image/jpeg', QUALITY);
  if (!jpeg || jpeg.size === 0) throw new Error('浏览器图片压缩失败。');
  return new File([jpeg], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function prepareBrandingImage(
  sourceFile: File,
  kind: BrandingImageKind,
): Promise<LocalBrandingImage> {
  if (!ACCEPTED_TYPES.has(sourceFile.type)) {
    throw new Error('只支持 JPG、PNG 或 WebP 图片。');
  }
  if (sourceFile.size <= 0) throw new Error('图片文件为空。');
  if (sourceFile.size > MAX_SOURCE_BYTES) throw new Error('本地原图不能超过 20 MB。');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(sourceFile);
  } catch {
    throw new Error(`无法读取图片“${sourceFile.name}”。`);
  }

  try {
    if (bitmap.width < MIN_EDGE || bitmap.height < MIN_EDGE) {
      throw new Error('图片宽高都必须至少为 48 像素。');
    }
    const scale = Math.min(1, maximumSide(kind) / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('当前浏览器无法创建图片处理画布。');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    const compressedFile = await encode(
      canvas,
      `${safeBaseName(sourceFile.name)}-${crypto.randomUUID().slice(0, 8)}`,
    );
    return {
      kind,
      sourceFile,
      compressedFile,
      previewUrl: URL.createObjectURL(compressedFile),
      width,
      height,
      originalByteSize: sourceFile.size,
    };
  } finally {
    bitmap.close();
  }
}

export function releaseBrandingImage(image: LocalBrandingImage | null): void {
  if (image) URL.revokeObjectURL(image.previewUrl);
}

export function formatBrandingBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
