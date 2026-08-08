import type { AdminProductMedia } from './api';

const PRODUCT_IMAGE_MAX_SIDE = 1400;
const PRODUCT_IMAGE_QUALITY = 0.82;
const MAX_LOCAL_SOURCE_BYTES = 30 * 1024 * 1024;
const MIN_IMAGE_SIDE = 200;
const ACCEPTED_SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ImageRotation = 0 | 90 | 180 | 270;

export type RemoteProductImage = {
  kind: 'remote';
  key: string;
  media: AdminProductMedia;
};

export type LocalProductImage = {
  kind: 'local';
  key: string;
  localId: string;
  sourceFile: File;
  compressedFile: File;
  previewUrl: string;
  originalName: string;
  originalByteSize: number;
  width: number;
  height: number;
  rotation: ImageRotation;
};

export type ProductEditorImage = RemoteProductImage | LocalProductImage;

export function toRemoteProductImage(media: AdminProductMedia): RemoteProductImage {
  return {
    kind: 'remote',
    key: `remote:${media.id}`,
    media,
  };
}

export function getEditorImageAssetId(image: ProductEditorImage): string | null {
  return image.kind === 'remote' ? image.media.id : null;
}

export function getEditorImagePreviewUrl(image: ProductEditorImage): string | null {
  return image.kind === 'remote' ? image.media.publicUrl : image.previewUrl;
}

export function getEditorImageFileName(image: ProductEditorImage): string {
  return image.kind === 'remote' ? image.media.fileName : image.compressedFile.name;
}

export function getEditorImageDimensions(image: ProductEditorImage): {
  width: number | null;
  height: number | null;
} {
  return image.kind === 'remote'
    ? { width: image.media.width, height: image.media.height }
    : { width: image.width, height: image.height };
}

export function getEditorImageByteSize(image: ProductEditorImage): number {
  return image.kind === 'remote' ? image.media.byteSize : image.compressedFile.size;
}

export function isEditorMediaVideo(image: ProductEditorImage): boolean {
  return image.kind === 'remote' && image.media.mimeType.toLowerCase().startsWith('video/');
}

export function isEditorMediaAnimated(image: ProductEditorImage): boolean {
  return image.kind === 'remote' && image.media.mimeType.toLowerCase() === 'image/gif';
}

export function isEditorMediaCoverEligible(image: ProductEditorImage): boolean {
  return !isEditorMediaVideo(image);
}

export function editorMediaKindLabel(image: ProductEditorImage): string {
  if (isEditorMediaVideo(image)) return '视频';
  if (isEditorMediaAnimated(image)) return 'GIF';
  return '图片';
}

export function formatImageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeRotation(rotation: number): ImageRotation {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

function outputFileBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const normalized = withoutExtension
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'product-image';
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function drawBitmap(
  bitmap: ImageBitmap,
  rotation: ImageRotation,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, PRODUCT_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const sourceWidth = Math.max(1, Math.round(bitmap.width * scale));
  const sourceHeight = Math.max(1, Math.round(bitmap.height * scale));
  const rotated = rotation === 90 || rotation === 270;
  const width = rotated ? sourceHeight : sourceWidth;
  const height = rotated ? sourceWidth : sourceHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('当前浏览器无法创建图片处理画布。');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.translate(width / 2, height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(bitmap, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
  return { canvas, width, height };
}

async function encodeCompressedImage(
  canvas: HTMLCanvasElement,
  baseName: string,
): Promise<File> {
  const webp = await canvasToBlob(canvas, 'image/webp', PRODUCT_IMAGE_QUALITY);
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
  const jpeg = await canvasToBlob(jpegCanvas, 'image/jpeg', PRODUCT_IMAGE_QUALITY);
  if (!jpeg || jpeg.size === 0) throw new Error('浏览器图片压缩失败。');
  return new File([jpeg], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function prepareLocalProductImage(
  sourceFile: File,
  rotation: ImageRotation = 0,
  localId: string = crypto.randomUUID(),
): Promise<LocalProductImage> {
  if (!ACCEPTED_SOURCE_TYPES.has(sourceFile.type)) {
    throw new Error('浏览器压缩只处理 JPG、PNG 或 WebP；GIF 和视频会直接进入素材中心。');
  }
  if (sourceFile.size <= 0) throw new Error('图片文件为空。');
  if (sourceFile.size > MAX_LOCAL_SOURCE_BYTES) {
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
      throw new Error(`图片“${sourceFile.name}”的宽高都必须至少为 200 像素。`);
    }
    const normalizedRotation = normalizeRotation(rotation);
    const rendered = drawBitmap(bitmap, normalizedRotation);
    const compressedFile = await encodeCompressedImage(
      rendered.canvas,
      `${outputFileBaseName(sourceFile.name)}-${localId.slice(0, 8)}`,
    );
    return {
      kind: 'local',
      key: `local:${localId}`,
      localId,
      sourceFile,
      compressedFile,
      previewUrl: URL.createObjectURL(compressedFile),
      originalName: sourceFile.name,
      originalByteSize: sourceFile.size,
      width: rendered.width,
      height: rendered.height,
      rotation: normalizedRotation,
    };
  } finally {
    bitmap.close();
  }
}

export async function rotateLocalProductImage(
  image: LocalProductImage,
  direction: -1 | 1,
): Promise<LocalProductImage> {
  const nextRotation = normalizeRotation(image.rotation + direction * 90);
  return prepareLocalProductImage(image.sourceFile, nextRotation, image.localId);
}

export function releaseLocalProductImage(image: LocalProductImage): void {
  URL.revokeObjectURL(image.previewUrl);
}

export function releaseLocalProductImages(images: ProductEditorImage[]): void {
  images.forEach((image) => {
    if (image.kind === 'local') releaseLocalProductImage(image);
  });
}
