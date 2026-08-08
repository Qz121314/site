import { AdminApiError } from '../api';
import {
  type ManagedMediaAsset,
  type MediaKind,
  type MediaRole,
} from './api';

export type MediaLibraryPage = {
  assets: ManagedMediaAsset[];
  nextCursor: string | null;
  total: number;
};

export type MediaLibraryPageFilters = {
  kinds?: MediaKind[] | undefined;
  role?: MediaRole | '' | undefined;
  folder?: string | undefined;
  query?: string | undefined;
  cursor?: string | null | undefined;
  limit?: number | undefined;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseRole(value: unknown): MediaRole {
  if (
    value === 'general' ||
    value === 'product' ||
    value === 'logo' ||
    value === 'icon' ||
    value === 'favicon' ||
    value === 'hero' ||
    value === 'background' ||
    value === 'content'
  ) {
    return value;
  }
  throw new AdminApiError(500, 'INVALID_RESPONSE', '素材用途返回数据无效。');
}

function parseAsset(value: unknown): ManagedMediaAsset {
  const media = asRecord(value);
  if (
    !media ||
    typeof media.id !== 'string' ||
    typeof media.objectKey !== 'string' ||
    typeof media.fileName !== 'string' ||
    typeof media.mimeType !== 'string' ||
    typeof media.byteSize !== 'number' ||
    (media.mediaKind !== 'image' && media.mediaKind !== 'animated_image' && media.mediaKind !== 'video') ||
    (typeof media.width !== 'number' && media.width !== null) ||
    (typeof media.height !== 'number' && media.height !== null) ||
    (typeof media.durationMs !== 'number' && media.durationMs !== null) ||
    (typeof media.folderId !== 'string' && media.folderId !== null) ||
    (typeof media.folderName !== 'string' && media.folderName !== null) ||
    !Array.isArray(media.roles) ||
    (typeof media.publicUrl !== 'string' && media.publicUrl !== null) ||
    typeof media.createdAt !== 'string' ||
    typeof media.updatedAt !== 'string'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材分页返回数据无效。');
  }

  return {
    id: media.id,
    objectKey: media.objectKey,
    fileName: media.fileName,
    mimeType: media.mimeType,
    byteSize: media.byteSize,
    mediaKind: media.mediaKind,
    width: media.width,
    height: media.height,
    durationMs: media.durationMs,
    folderId: media.folderId,
    folderName: media.folderName,
    roles: media.roles.map(parseRole),
    publicUrl: media.publicUrl,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

export async function fetchMediaLibraryPage(
  filters: MediaLibraryPageFilters = {},
): Promise<MediaLibraryPage> {
  const query = new URLSearchParams();
  if (filters.kinds?.length) query.set('kinds', filters.kinds.join(','));
  if (filters.role) query.set('role', filters.role);
  if (filters.folder && filters.folder !== 'all') query.set('folder', filters.folder);
  if (filters.query?.trim()) query.set('q', filters.query.trim());
  if (filters.cursor) query.set('cursor', filters.cursor);
  if (filters.limit) query.set('limit', String(filters.limit));

  const response = await fetch(`/api/admin/assets/library/page?${query.toString()}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const contentType = response.headers.get('content-type') ?? '';
  const body: unknown = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const envelope = asRecord(body) as ErrorEnvelope | null;
    throw new AdminApiError(
      response.status,
      envelope?.error?.code ?? 'MEDIA_LIBRARY_PAGE_FAILED',
      envelope?.error?.message ?? '素材分页加载失败。',
      envelope?.error?.details,
    );
  }

  const page = asRecord(body);
  if (
    !page ||
    !Array.isArray(page.assets) ||
    (typeof page.nextCursor !== 'string' && page.nextCursor !== null) ||
    typeof page.total !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材分页响应无效。');
  }

  return {
    assets: page.assets.map(parseAsset),
    nextCursor: page.nextCursor,
    total: page.total,
  };
}
