import { AdminApiError } from '../api';
import { adminFetch } from '../admin-fetch';
import type { BrandingImageKind } from './local-branding-image';

const BRANDING_IMAGE_COMPRESSION_PROFILE = 'browser-branding-image-v1';

export type AdminBrandingMedia = {
  id: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  publicUrl: string | null;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: { field?: string };
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseMedia(value: unknown): AdminBrandingMedia {
  const media = asRecord(value);
  if (
    !media ||
    typeof media.id !== 'string' ||
    typeof media.objectKey !== 'string' ||
    typeof media.fileName !== 'string' ||
    typeof media.mimeType !== 'string' ||
    typeof media.byteSize !== 'number' ||
    typeof media.width !== 'number' ||
    typeof media.height !== 'number' ||
    (typeof media.publicUrl !== 'string' && media.publicUrl !== null)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '图片上传返回数据无效。');
  }
  return media as AdminBrandingMedia;
}

export async function uploadBrandingImage(
  kind: BrandingImageKind,
  file: File,
): Promise<{ media: AdminBrandingMedia; reused: boolean }> {
  const formData = new FormData();
  formData.set('kind', kind);
  formData.set('file', file);
  formData.set('compressionProfile', BRANDING_IMAGE_COMPRESSION_PROFILE);
  const response = await adminFetch('/api/admin/media/branding', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'x-admin-request': '1' },
    body: formData,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const body: unknown = contentType.includes('application/json')
    ? await response.json()
    : null;
  if (!response.ok) {
    const envelope = asRecord(body) as ErrorEnvelope | null;
    throw new AdminApiError(
      response.status,
      envelope?.error?.code ?? 'BRANDING_UPLOAD_FAILED',
      envelope?.error?.message ?? '图片上传失败。',
      envelope?.error?.details,
    );
  }
  const envelope = asRecord(body);
  return {
    media: parseMedia(envelope?.media),
    reused: envelope?.reused === true,
  };
}

export function adminMediaThumbnailUrl(assetId: string): string {
  return `/api/admin/media/assets/${encodeURIComponent(assetId)}/thumbnail`;
}

export function brandingAssetPreviewUrl(assetId: string): string {
  return adminMediaThumbnailUrl(assetId);
}
