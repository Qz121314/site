import type { AdminProductMedia } from './api';

export type ProductEditorImage = {
  kind: 'remote';
  key: string;
  media: AdminProductMedia;
};

export function toRemoteProductImage(media: AdminProductMedia): ProductEditorImage {
  return {
    kind: 'remote',
    key: `remote:${media.id}`,
    media,
  };
}

export function getEditorImagePreviewUrl(image: ProductEditorImage): string | null {
  return image.media.publicUrl;
}

export function getEditorImageFileName(image: ProductEditorImage): string {
  return image.media.fileName;
}

export function getEditorImageDimensions(image: ProductEditorImage): {
  width: number | null;
  height: number | null;
} {
  return { width: image.media.width, height: image.media.height };
}

export function getEditorImageByteSize(image: ProductEditorImage): number {
  return image.media.byteSize;
}

export function isEditorMediaVideo(image: ProductEditorImage): boolean {
  return image.media.mimeType.toLowerCase().startsWith('video/');
}

export function isEditorMediaAnimated(image: ProductEditorImage): boolean {
  return image.media.mimeType.toLowerCase() === 'image/gif';
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
