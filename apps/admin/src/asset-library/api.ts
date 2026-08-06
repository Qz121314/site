import { AdminApiError } from '../api';

export type AssetReferenceCounts = {
  logo: number;
  sectionIcon: number;
  productCover: number;
  productGallery: number;
};

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

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: {
      blockedKey?: string;
      blockedReason?: string;
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

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);

  if (!response.ok) {
    const envelope = (asRecord(body) ?? {}) as ApiErrorEnvelope;
    throw new AdminApiError(
      response.status,
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? '素材库请求失败。',
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

export function fetchAssetPage(cursor?: string): Promise<AssetScanPage> {
  const query = new URLSearchParams({ limit: '500' });
  if (cursor) {
    query.set('cursor', cursor);
  }

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