import { AdminApiError } from '../api';

export type FaqScope = 'active' | 'trash' | 'all';

export type AdminFaq = {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type FaqInput = {
  title: string;
  body: string;
  sortOrder: number;
  isEnabled: boolean;
};

type ErrorEnvelope = { error?: { code?: string; message?: string } };

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
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
  const body = await readJson(response);
  if (!response.ok) {
    const envelope = asRecord(body) as ErrorEnvelope | null;
    throw new AdminApiError(
      response.status,
      envelope?.error?.code ?? 'FAQ_REQUEST_FAILED',
      envelope?.error?.message ?? 'FAQ 请求失败。',
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

function parseFaq(value: unknown): AdminFaq {
  const faq = asRecord(value);
  if (
    !faq ||
    typeof faq.id !== 'string' ||
    typeof faq.title !== 'string' ||
    typeof faq.body !== 'string' ||
    typeof faq.sortOrder !== 'number' ||
    typeof faq.isEnabled !== 'boolean' ||
    typeof faq.createdAt !== 'string' ||
    typeof faq.updatedAt !== 'string' ||
    (typeof faq.deletedAt !== 'string' && faq.deletedAt !== null)
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'FAQ 返回数据无效。');
  }
  return faq as AdminFaq;
}

function parseFaqEnvelope(value: unknown): AdminFaq {
  return parseFaq(asRecord(value)?.faq);
}

function parseFaqList(value: unknown): AdminFaq[] {
  const faqs = asRecord(value)?.faqs;
  if (!Array.isArray(faqs)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'FAQ 列表返回数据无效。');
  }
  return faqs.map(parseFaq);
}

export function fetchFaqs(scope: FaqScope = 'active'): Promise<AdminFaq[]> {
  return requestJson(`/api/admin/faqs/?scope=${encodeURIComponent(scope)}`).then(parseFaqList);
}

export function createFaq(input: FaqInput): Promise<AdminFaq> {
  return writeRequest('/api/admin/faqs/', 'POST', input).then(parseFaqEnvelope);
}

export function updateFaq(id: string, input: FaqInput): Promise<AdminFaq> {
  return writeRequest(`/api/admin/faqs/${encodeURIComponent(id)}`, 'PUT', input).then(parseFaqEnvelope);
}

export function deleteFaq(id: string): Promise<AdminFaq> {
  return writeRequest(`/api/admin/faqs/${encodeURIComponent(id)}`, 'DELETE').then(parseFaqEnvelope);
}

export function restoreFaq(id: string): Promise<AdminFaq> {
  return writeRequest(`/api/admin/faqs/${encodeURIComponent(id)}/restore`, 'POST').then(parseFaqEnvelope);
}

export async function batchDeleteFaqs(ids: string[]): Promise<string[]> {
  const body = await requestJson('/api/admin/faqs/batch-delete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ids }),
  });
  const result = asRecord(body);
  if (!result || !Array.isArray(result.deletedIds) || !result.deletedIds.every((id) => typeof id === 'string')) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'FAQ 批量删除返回数据无效。');
  }
  return result.deletedIds;
}

export async function reorderFaqs(items: Array<{ id: string; sortOrder: number }>): Promise<void> {
  const body = await requestJson('/api/admin/faqs/reorder', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ items }),
  });
  if (asRecord(body)?.reordered !== true) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'FAQ 排序返回数据无效。');
  }
}
