import { AdminApiError } from '../api';

export type AdminProductTag = {
  id: string;
  sectionId: string;
  name: string;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  productCount: number;
};

export type ProductTagInput = {
  name: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type ProductTagScope = 'active' | 'trash' | 'all';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
    const error = asRecord(asRecord(body)?.error);
    const details = asRecord(error?.details);
    throw new AdminApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'PRODUCT_TAG_REQUEST_FAILED',
      typeof error?.message === 'string' ? error.message : '标签请求失败。',
      {
        ...(typeof details?.field === 'string' ? { field: details.field } : {}),
        ...(typeof details?.productCount === 'number' ? { productCount: details.productCount } : {}),
      },
    );
  }
  return body;
}

function writeRequest(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  return requestJson(path, {
    method,
    headers: {
      'x-admin-request': '1',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function parseTag(value: unknown): AdminProductTag {
  const tag = asRecord(value);
  if (
    !tag ||
    typeof tag.id !== 'string' ||
    typeof tag.sectionId !== 'string' ||
    typeof tag.name !== 'string' ||
    typeof tag.sortOrder !== 'number' ||
    typeof tag.isEnabled !== 'boolean' ||
    typeof tag.createdAt !== 'string' ||
    typeof tag.updatedAt !== 'string' ||
    (typeof tag.deletedAt !== 'string' && tag.deletedAt !== null) ||
    typeof tag.productCount !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '标签返回数据无效。');
  }
  return tag as AdminProductTag;
}

function parseTagEnvelope(value: unknown): AdminProductTag {
  return parseTag(asRecord(value)?.tag);
}

function basePath(sectionId: string) {
  return `/api/admin/sections/${encodeURIComponent(sectionId)}/tags`;
}

export async function fetchProductTags(
  sectionId: string,
  scope: ProductTagScope = 'active',
): Promise<AdminProductTag[]> {
  const body = await requestJson(`${basePath(sectionId)}?scope=${encodeURIComponent(scope)}`);
  const tags = asRecord(body)?.tags;
  if (!Array.isArray(tags)) throw new AdminApiError(500, 'INVALID_RESPONSE', '标签列表返回数据无效。');
  return tags.map(parseTag);
}

export function createProductTag(sectionId: string, input: ProductTagInput): Promise<AdminProductTag> {
  return writeRequest(basePath(sectionId), 'POST', input).then(parseTagEnvelope);
}

export function updateProductTag(
  sectionId: string,
  id: string,
  input: ProductTagInput,
): Promise<AdminProductTag> {
  return writeRequest(`${basePath(sectionId)}/${encodeURIComponent(id)}`, 'PUT', input).then(parseTagEnvelope);
}

export function deleteProductTag(sectionId: string, id: string): Promise<AdminProductTag> {
  return writeRequest(`${basePath(sectionId)}/${encodeURIComponent(id)}`, 'DELETE').then(parseTagEnvelope);
}

export function restoreProductTag(sectionId: string, id: string): Promise<AdminProductTag> {
  return writeRequest(`${basePath(sectionId)}/${encodeURIComponent(id)}/restore`, 'POST').then(parseTagEnvelope);
}

export async function batchDeleteProductTags(sectionId: string, ids: string[]): Promise<string[]> {
  const body = await requestJson(`${basePath(sectionId)}/batch-delete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ids }),
  });
  const deletedIds = asRecord(body)?.deletedIds;
  if (!Array.isArray(deletedIds) || !deletedIds.every((id) => typeof id === 'string')) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '标签批量删除返回数据无效。');
  }
  return deletedIds;
}

export async function reorderProductTags(
  sectionId: string,
  items: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  const body = await requestJson(`${basePath(sectionId)}/reorder`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ items }),
  });
  if (asRecord(body)?.reordered !== true) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '标签排序返回数据无效。');
  }
}
