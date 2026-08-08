import { AdminApiError } from '../api';

export type MediaDeleteResponse = {
  deletedIds: string[];
  deletedKeys: string[];
  deletedCount: number;
  freedBytes: number;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: { blockedKey?: string; blockedReason?: string };
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function deleteMediaAssets(ids: string[]): Promise<MediaDeleteResponse> {
  const response = await fetch('/api/admin/assets/library/delete', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ids }),
  });
  const body = response.headers.get('content-type')?.includes('application/json')
    ? ((await response.json()) as unknown)
    : null;
  if (!response.ok) {
    const envelope = asRecord(body) as ErrorEnvelope | null;
    throw new AdminApiError(
      response.status,
      envelope?.error?.code ?? 'MEDIA_DELETE_FAILED',
      envelope?.error?.message ?? '素材删除失败。',
      envelope?.error?.details,
    );
  }

  const result = asRecord(body);
  if (
    !result ||
    !Array.isArray(result.deletedIds) ||
    !result.deletedIds.every((id) => typeof id === 'string') ||
    !Array.isArray(result.deletedKeys) ||
    !result.deletedKeys.every((key) => typeof key === 'string') ||
    typeof result.deletedCount !== 'number' ||
    typeof result.freedBytes !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '素材删除返回数据无效。');
  }
  return result as MediaDeleteResponse;
}
