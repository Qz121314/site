import { AdminApiError } from '../api';
import { adminFetch } from '../admin-fetch';
import {
  isCompressibleStaticMediaImage,
  prepareCompressedMediaImage,
} from './media-image-compression';

export type AssetReferenceCounts = {
  logo: number;
  sectionIcon: number;
  productCover: number;
  productGallery: number;
};

export type AssetCleanupBlockedReason =
  | 'IN_USE'
  | 'NOT_IMAGE'
  | 'SNAPSHOT_RETENTION'
  | null;

export type AdminAsset = {
  key: string;
  size: number;
  uploadedAt: string;
  etag: string;
  contentType: string | null;
  usageStatus: 'used' | 'unused';
  referenceCount: number;
  references: AssetReferenceCounts;
  cleanupEligible: boolean;
  cleanupBlockedReason: AssetCleanupBlockedReason;
  publicUrl: string | null;
};

export type AssetScanPage = {
  assets: AdminAsset[];
  cursor: string | null;
  truncated: boolean;
  mediaBaseUrl: string | null;
  scannedCount: number;
};

export type AssetCleanupResponse = {
  deletedKeys: string[];
  deletedCount: number;
  alreadyMissingCount: number;
  freedBytes: number;
};

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

export type MediaFolder = {
  id: string;
  name: string;
  sortOrder: number;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ManagedMediaAsset = {
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

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: {
      blockedKey?: string;
      blockedReason?: string;
      field?: string;
    };
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : null;
}

function readError(value: unknown): ApiErrorEnvelope {
  return asRecord(value) ? (value as ApiErrorEnvelope) : {};
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await adminFetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);

  if (!response.ok) {
    const envelope = readError(body);
    throw new AdminApiError(
      response.status,
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? '素材中心请求失败。',
      envelope.error?.details,
    );
  }

  return body;
}

function parseReferences(value: unknown): AssetReferenceCounts {
  const references = asRecord(value);
  if (
    !references ||
    typeof references.logo !== 'number' ||
    typeof references.sectionIcon !== 'number' ||
    typeof references.productCover !== 'number' ||
    typeof references.productGallery !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '图片引用数据无效。');
  }

  return {
    logo: references.logo,
    sectionIcon: references.sectionIcon,
    productCover: references.productCover,
    productGallery: references.productGallery,
  };
}

function parseCleanupBlockedReason(value: unknown): AssetCleanupBlockedReason {
  if (
    value === null ||
    value === 'IN_USE' ||
    value === 'NOT_IMAGE' ||
    value === 'SNAPSHOT_RETENTION'
  ) {
    return value;
  }
  throw new AdminApiError(500, 'INVALID_RESPONSE', '图片清理状态返回数据无效。');
}

function parseAsset(value: unknown): AdminAsset {
  const asset = asRecord(value);
  if (
    !asset ||
    typeof asset.key !== 'string' ||
    typeof asset.size !== 'number' ||
    typeof asset.uploadedAt !== 'string' ||
    typeof asset.etag !== 'string' ||
    (typeof asset.contentType !== 'string' && asset.contentType !== null) ||
    (asset.usageStatus !== 'used' && asset.usageStatus !== 'unused') ||
    typeof asset.referenceCount !== 'number' ||
    typeof asset.cleanupEligible !== 'boolean' ||
    (typeof asset.publicUrl !== 'string' && asset.publicUrl !== null)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'R2 图片数据无效。');
  }

  return {
    key: asset.key,
    size: asset.size,
    uploadedAt: asset.uploadedAt,
    etag: asset.etag,
    contentType: asset.contentType,
    usageStatus: asset.usageStatus,
    referenceCount: asset.referenceCount,
    references: parseReferences(asset.references),
    cleanupEligible: asset.cleanupEligible,
    cleanupBlockedReason: parseCleanupBlockedReason(asset.cleanupBlockedReason),
    publicUrl: asset.publicUrl,
  };
}

function parseScanPage(value: unknown): AssetScanPage {
  const page = asRecord(value);
  if (
    !page ||
    !Array.isArray(page.assets) ||
    (typeof page.cursor !== 'string' && page.cursor !== null) ||
    typeof page.truncated !== 'boolean' ||
    (typeof page.mediaBaseUrl !== 'string' && page.mediaBaseUrl !== null) ||
    typeof page.scannedCount !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'R2 扫描返回数据无效。');
  }

  return {
    assets: page.assets.map(parseAsset),
    cursor: page.cursor,
    truncated: page.truncated,
    mediaBaseUrl: page.mediaBaseUrl,
    scannedCount: page.scannedCount,
  };
}

function parseCleanupResponse(value: unknown): AssetCleanupResponse {
  const result = asRecord(value);
  if (
    !result ||
    !Array.isArray(result.deletedKeys) ||
    !result.deletedKeys.every((key) => typeof key === 'string') ||
    typeof result.deletedCount !== 'number' ||
    typeof result.alreadyMissingCount !== 'number' ||
    typeof result.freedBytes !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'R2 清理返回数据无效。');
  }

  return {
    deletedKeys: result.deletedKeys,
    deletedCount: result.deletedCount,
    alreadyMissingCount: result.alreadyMissingCount,
    freedBytes: result.freedBytes,
  };
}

function parseMediaRole(value: unknown): MediaRole {
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

function parseMediaFolder(value: unknown): MediaFolder {
  const folder = asRecord(value);
  if (
    !folder ||
    typeof folder.id !== 'string' ||
    typeof folder.name !== 'string' ||
    typeof folder.sortOrder !== 'number' ||
    typeof folder.assetCount !== 'number' ||
    typeof folder.createdAt !== 'string' ||
    typeof folder.updatedAt !== 'string'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材文件夹返回数据无效。');
  }
  return {
    id: folder.id,
    name: folder.name,
    sortOrder: folder.sortOrder,
    assetCount: folder.assetCount,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

function parseManagedMedia(value: unknown): ManagedMediaAsset {
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
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材数据无效。');
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
    roles: media.roles.map(parseMediaRole),
    publicUrl: media.publicUrl,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

export function fetchAssetPage(cursor?: string): Promise<AssetScanPage> {
  const query = new URLSearchParams({ limit: '500' });
  if (cursor) query.set('cursor', cursor);
  return requestJson(`/api/admin/assets/?${query.toString()}`).then(parseScanPage);
}

export function cleanupAssets(keys: string[]): Promise<AssetCleanupResponse> {
  return requestJson('/api/admin/assets/cleanup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ keys }),
  }).then(parseCleanupResponse);
}

export async function fetchMediaLibrary(filters?: {
  kind?: MediaKind | '';
  role?: MediaRole | '';
}): Promise<ManagedMediaAsset[]> {
  const query = new URLSearchParams();
  if (filters?.kind) query.set('kind', filters.kind);
  if (filters?.role) query.set('role', filters.role);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const body = await requestJson(`/api/admin/assets/library${suffix}`);
  const assets = asRecord(body)?.assets;
  if (!Array.isArray(assets)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材列表返回数据无效。');
  }
  return assets.map(parseManagedMedia);
}

export async function fetchMediaFolders(): Promise<MediaFolder[]> {
  const body = await requestJson('/api/admin/assets/folders');
  const folders = asRecord(body)?.folders;
  if (!Array.isArray(folders)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材文件夹列表返回数据无效。');
  }
  return folders.map(parseMediaFolder);
}

export async function createMediaFolder(name: string): Promise<{ folder: MediaFolder; reused: boolean }> {
  const body = asRecord(await requestJson('/api/admin/assets/folders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
    body: JSON.stringify({ name }),
  }));
  return {
    folder: parseMediaFolder(body?.folder),
    reused: body?.reused === true,
  };
}

export async function renameMediaFolder(id: string, name: string): Promise<MediaFolder> {
  const body = asRecord(await requestJson(`/api/admin/assets/folders/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
    body: JSON.stringify({ name }),
  }));
  return parseMediaFolder(body?.folder);
}

export async function deleteMediaFolder(id: string): Promise<void> {
  await requestJson(`/api/admin/assets/folders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-request': '1' },
  });
}

export async function moveMediaAssets(ids: string[], folderId: string | null): Promise<number> {
  const body = asRecord(await requestJson('/api/admin/assets/folders/move', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
    body: JSON.stringify({ ids, folderId }),
  }));
  if (typeof body?.movedCount !== 'number') {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材移动返回数据无效。');
  }
  return body.movedCount;
}

export async function uploadMediaAsset(input: {
  file: File;
  role: MediaRole;
  folderId?: string | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  durationMs?: number | null | undefined;
}): Promise<{ media: ManagedMediaAsset; reused: boolean }> {
  const preparedImage = isCompressibleStaticMediaImage(input.file)
    ? await prepareCompressedMediaImage(input.file)
    : null;
  const uploadFile = preparedImage?.file ?? input.file;
  const formData = new FormData();
  formData.set('file', uploadFile);
  formData.set('role', input.role);
  if (input.folderId) formData.set('folderId', input.folderId);

  if (preparedImage) {
    formData.set('width', String(preparedImage.width));
    formData.set('height', String(preparedImage.height));
    formData.set('compressionProfile', preparedImage.compressionProfile);
    formData.set('sourceByteSize', String(preparedImage.sourceByteSize));
  } else {
    if (input.width !== undefined && input.width !== null) formData.set('width', String(input.width));
    if (input.height !== undefined && input.height !== null) formData.set('height', String(input.height));
  }

  if (input.durationMs !== undefined && input.durationMs !== null) {
    formData.set('durationMs', String(input.durationMs));
  }

  const body = await requestJson('/api/admin/assets/upload', {
    method: 'POST',
    headers: { 'x-admin-request': '1' },
    body: formData,
  });
  const envelope = asRecord(body);
  return {
    media: parseManagedMedia(envelope?.media),
    reused: envelope?.reused === true,
  };
}
