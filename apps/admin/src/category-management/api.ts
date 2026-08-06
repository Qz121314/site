import { AdminApiError } from '../api';

export type AdminCategory = {
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

export type CategoryInput = {
  name: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type CategoryScope = 'active' | 'trash' | 'all';

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: {
      field?: string;
      productCount?: number;
    };
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

function readError(value: unknown): ErrorEnvelope {
  return asRecord(value) ? (value as ErrorEnvelope) : {};
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);

  if (!response.ok) {
    const envelope = readError(body);
    throw new AdminApiError(
      response.status,
      envelope.error?.code ?? 'CATEGORY_REQUEST_FAILED',
      envelope.error?.message ?? '分类请求失败。',
      envelope.error?.details,
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

function parseCategory(value: unknown): AdminCategory {
  const category = asRecord(value);
  if (
    !category ||
    typeof category.id !== 'string' ||
    typeof category.sectionId !== 'string' ||
    typeof category.name !== 'string' ||
    typeof category.sortOrder !== 'number' ||
    typeof category.isEnabled !== 'boolean' ||
    typeof category.createdAt !== 'string' ||
    typeof category.updatedAt !== 'string' ||
    (typeof category.deletedAt !== 'string' && category.deletedAt !== null) ||
    typeof category.productCount !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分类返回数据无效。');
  }

  return {
    id: category.id,
    sectionId: category.sectionId,
    name: category.name,
    sortOrder: category.sortOrder,
    isEnabled: category.isEnabled,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    deletedAt: category.deletedAt,
    productCount: category.productCount,
  };
}

function parseCategoryEnvelope(value: unknown): AdminCategory {
  const envelope = asRecord(value);
  return parseCategory(envelope?.category);
}

function parseCategoryList(value: unknown): AdminCategory[] {
  const envelope = asRecord(value);
  if (!envelope || !Array.isArray(envelope.categories)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分类列表返回数据无效。');
  }
  return envelope.categories.map(parseCategory);
}

function basePath(sectionId: string): string {
  return `/api/admin/sections/${encodeURIComponent(sectionId)}/categories`;
}

export function fetchCategories(
  sectionId: string,
  scope: CategoryScope = 'active',
): Promise<AdminCategory[]> {
  return requestJson(`${basePath(sectionId)}?scope=${encodeURIComponent(scope)}`).then(
    parseCategoryList,
  );
}

export function createCategory(
  sectionId: string,
  input: CategoryInput,
): Promise<AdminCategory> {
  return writeRequest(basePath(sectionId), 'POST', input).then(parseCategoryEnvelope);
}

export function updateCategory(
  sectionId: string,
  id: string,
  input: CategoryInput,
): Promise<AdminCategory> {
  return writeRequest(`${basePath(sectionId)}/${encodeURIComponent(id)}`, 'PUT', input).then(
    parseCategoryEnvelope,
  );
}

export function deleteCategory(sectionId: string, id: string): Promise<AdminCategory> {
  return writeRequest(`${basePath(sectionId)}/${encodeURIComponent(id)}`, 'DELETE').then(
    parseCategoryEnvelope,
  );
}

export function restoreCategory(sectionId: string, id: string): Promise<AdminCategory> {
  return writeRequest(
    `${basePath(sectionId)}/${encodeURIComponent(id)}/restore`,
    'POST',
  ).then(parseCategoryEnvelope);
}

export async function batchDeleteCategories(sectionId: string, ids: string[]): Promise<string[]> {
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
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分类批量删除返回数据无效。');
  }
  return result.deletedIds;
}

export async function reorderCategories(
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
  const result = asRecord(body);
  if (!result || result.reordered !== true) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '分类排序返回数据无效。');
  }
}
