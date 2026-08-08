import { AdminApiError } from '../api';
import { adminFetch } from '../admin-fetch';

export type ProductServiceMode = 'online' | 'offline';
export type ProductStatus = 'draft' | 'published' | 'archived';
export type ProductScope = 'active' | 'trash' | 'all';

export type AdminProductMedia = {
  id: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  altText: string | null;
  publicUrl: string | null;
};

export type AdminProductTag = {
  id: string;
  name: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type AdminProduct = {
  id: string;
  sectionId: string;
  slug: string;
  serviceMode: ProductServiceMode;
  title: string;
  body: string;
  address: string | null;
  categoryId: string | null;
  categoryName: string | null;
  tags: AdminProductTag[];
  tagIds: string[];
  conversionGroupId: string | null;
  conversionGroupName: string | null;
  conversionMode: 'customer_service' | 'link' | null;
  buttonLabel: string | null;
  coverAssetId: string | null;
  effectiveCoverAssetId: string | null;
  effectiveCoverUrl: string | null;
  media: AdminProductMedia[];
  isFeatured: boolean;
  featuredOrder: number;
  sortOrder: number;
  status: ProductStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ProductInput = {
  serviceMode: ProductServiceMode;
  title: string;
  body: string;
  address: string | null;
  categoryId: string | null;
  tagIds: string[];
  conversionGroupId: string | null;
  coverAssetId: string | null;
  mediaAssetIds: string[];
  isFeatured: boolean;
  featuredOrder: number;
  sortOrder: number;
  status: ProductStatus;
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

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : null;
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await adminFetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);
  if (!response.ok) {
    const envelope = asRecord(body) as ErrorEnvelope | null;
    throw new AdminApiError(
      response.status,
      envelope?.error?.code ?? 'PRODUCT_REQUEST_FAILED',
      envelope?.error?.message ?? '产品请求失败。',
      envelope?.error?.details,
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

function parseMedia(value: unknown): AdminProductMedia {
  const media = asRecord(value);
  if (
    !media ||
    typeof media.id !== 'string' ||
    typeof media.objectKey !== 'string' ||
    typeof media.fileName !== 'string' ||
    typeof media.mimeType !== 'string' ||
    typeof media.byteSize !== 'number' ||
    (typeof media.width !== 'number' && media.width !== null) ||
    (typeof media.height !== 'number' && media.height !== null) ||
    typeof media.sortOrder !== 'number' ||
    (typeof media.altText !== 'string' && media.altText !== null) ||
    (typeof media.publicUrl !== 'string' && media.publicUrl !== null)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '产品图片返回数据无效。');
  }
  return media as AdminProductMedia;
}

function parseProductTag(value: unknown): AdminProductTag {
  const tag = asRecord(value);
  if (
    !tag ||
    typeof tag.id !== 'string' ||
    typeof tag.name !== 'string' ||
    typeof tag.sortOrder !== 'number' ||
    typeof tag.isEnabled !== 'boolean'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '产品标签返回数据无效。');
  }
  return tag as AdminProductTag;
}

function parseProduct(value: unknown): AdminProduct {
  const product = asRecord(value);
  if (
    !product ||
    typeof product.id !== 'string' ||
    typeof product.sectionId !== 'string' ||
    typeof product.slug !== 'string' ||
    (product.serviceMode !== 'online' && product.serviceMode !== 'offline') ||
    typeof product.title !== 'string' ||
    typeof product.body !== 'string' ||
    (typeof product.address !== 'string' && product.address !== null) ||
    (typeof product.categoryId !== 'string' && product.categoryId !== null) ||
    (typeof product.categoryName !== 'string' && product.categoryName !== null) ||
    !Array.isArray(product.tags) ||
    !Array.isArray(product.tagIds) ||
    !product.tagIds.every((id) => typeof id === 'string') ||
    (typeof product.conversionGroupId !== 'string' && product.conversionGroupId !== null) ||
    (typeof product.conversionGroupName !== 'string' && product.conversionGroupName !== null) ||
    (product.conversionMode !== 'customer_service' &&
      product.conversionMode !== 'link' &&
      product.conversionMode !== null) ||
    (typeof product.buttonLabel !== 'string' && product.buttonLabel !== null) ||
    (typeof product.coverAssetId !== 'string' && product.coverAssetId !== null) ||
    (typeof product.effectiveCoverAssetId !== 'string' && product.effectiveCoverAssetId !== null) ||
    (typeof product.effectiveCoverUrl !== 'string' && product.effectiveCoverUrl !== null) ||
    !Array.isArray(product.media) ||
    typeof product.isFeatured !== 'boolean' ||
    typeof product.featuredOrder !== 'number' ||
    typeof product.sortOrder !== 'number' ||
    (product.status !== 'draft' && product.status !== 'published' && product.status !== 'archived') ||
    (typeof product.publishedAt !== 'string' && product.publishedAt !== null) ||
    typeof product.createdAt !== 'string' ||
    typeof product.updatedAt !== 'string' ||
    (typeof product.deletedAt !== 'string' && product.deletedAt !== null)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '产品返回数据无效。');
  }
  return {
    ...(product as Omit<AdminProduct, 'media' | 'tags'>),
    media: product.media.map(parseMedia),
    tags: product.tags.map(parseProductTag),
  };
}

function parseProductEnvelope(value: unknown): AdminProduct {
  return parseProduct(asRecord(value)?.product);
}

function parseProductList(value: unknown): AdminProduct[] {
  const products = asRecord(value)?.products;
  if (!Array.isArray(products)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '产品列表返回数据无效。');
  }
  return products.map(parseProduct);
}

function basePath(sectionId: string): string {
  return `/api/admin/sections/${encodeURIComponent(sectionId)}/products`;
}

export function fetchProducts(
  sectionId: string,
  scope: ProductScope = 'active',
): Promise<AdminProduct[]> {
  return requestJson(`${basePath(sectionId)}?scope=${encodeURIComponent(scope)}`).then(
    parseProductList,
  );
}

export function fetchProduct(sectionId: string, productId: string): Promise<AdminProduct> {
  return requestJson(`${basePath(sectionId)}/${encodeURIComponent(productId)}`).then(
    parseProductEnvelope,
  );
}

export function createProduct(sectionId: string, input: ProductInput): Promise<AdminProduct> {
  return writeRequest(basePath(sectionId), 'POST', input).then(parseProductEnvelope);
}

export function updateProduct(
  sectionId: string,
  productId: string,
  input: ProductInput,
): Promise<AdminProduct> {
  return writeRequest(`${basePath(sectionId)}/${encodeURIComponent(productId)}`, 'PUT', input).then(
    parseProductEnvelope,
  );
}

export function deleteProduct(sectionId: string, productId: string): Promise<AdminProduct> {
  return writeRequest(`${basePath(sectionId)}/${encodeURIComponent(productId)}`, 'DELETE').then(
    parseProductEnvelope,
  );
}

export function restoreProduct(sectionId: string, productId: string): Promise<AdminProduct> {
  return writeRequest(
    `${basePath(sectionId)}/${encodeURIComponent(productId)}/restore`,
    'POST',
  ).then(parseProductEnvelope);
}

export async function uploadProductImage(
  sectionId: string,
  file: File,
): Promise<{ media: AdminProductMedia; reused: boolean }> {
  const formData = new FormData();
  formData.set('file', file);
  const body = await requestJson(`${basePath(sectionId)}/media`, {
    method: 'POST',
    headers: { 'x-admin-request': '1' },
    body: formData,
  });
  const envelope = asRecord(body);
  return {
    media: parseMedia(envelope?.media),
    reused: envelope?.reused === true,
  };
}

export async function batchDeleteProducts(sectionId: string, ids: string[]): Promise<string[]> {
  const body = await requestJson(`${basePath(sectionId)}/batch-delete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ids }),
  });
  const result = asRecord(body);
  if (
    !result ||
    !Array.isArray(result.deletedIds) ||
    !result.deletedIds.every((id) => typeof id === 'string')
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '产品批量删除返回数据无效。');
  }
  return result.deletedIds;
}

export async function reorderProducts(
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
    throw new AdminApiError(500, 'INVALID_RESPONSE', '产品排序返回数据无效。');
  }
}
