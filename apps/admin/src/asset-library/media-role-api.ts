import { AdminApiError } from '../api';
import type { MediaRole } from './api';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function assignMediaRole(id: string, role: MediaRole): Promise<void> {
  const response = await fetch('/api/admin/assets/library/role', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({ id, role }),
  });
  if (response.ok) return;

  const body = response.headers.get('content-type')?.includes('application/json')
    ? ((await response.json()) as unknown)
    : null;
  const error = asRecord(asRecord(body)?.error);
  throw new AdminApiError(
    response.status,
    typeof error?.code === 'string' ? error.code : 'MEDIA_ROLE_ASSIGN_FAILED',
    typeof error?.message === 'string' ? error.message : '素材用途更新失败。',
  );
}
