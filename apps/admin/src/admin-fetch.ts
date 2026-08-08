export type AdminMutationDetail = {
  method: string;
  path: string;
};

export type AdminSessionExpiredDetail = {
  path: string;
};

export const ADMIN_SESSION_EXPIRED_EVENT = 'admin:session-expired';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  return input instanceof Request ? input.method.toUpperCase() : 'GET';
}

function requestPath(input: RequestInfo | URL): string | null {
  const raw =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  try {
    return new URL(raw, window.location.href).pathname;
  } catch {
    return null;
  }
}

export function shouldNotifyAdminMutation(method: string, path: string | null): path is string {
  const normalizedMethod = method.toUpperCase();
  return (
    MUTATION_METHODS.has(normalizedMethod) &&
    path?.startsWith('/api/admin/') === true &&
    !path.startsWith('/api/admin/auth/') &&
    !path.startsWith('/api/admin/publish') &&
    path !== '/api/admin/settings/media-domain/test' &&
    path !== '/api/admin/theme/import'
  );
}

export function shouldNotifyAdminSessionExpired(status: number, path: string | null): path is string {
  return (
    status === 401 &&
    path?.startsWith('/api/admin/') === true &&
    !path.startsWith('/api/admin/auth/')
  );
}

export function notifyAdminChanged(detail: AdminMutationDetail): void {
  window.dispatchEvent(new CustomEvent('admin:data-mutated', { detail }));
}

export function notifyAdminSessionExpired(detail: AdminSessionExpiredDetail): void {
  window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT, { detail }));
}

export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = requestMethod(input, init);
  const path = requestPath(input);
  const response = await fetch(input, init);

  if (shouldNotifyAdminSessionExpired(response.status, path)) {
    queueMicrotask(() => notifyAdminSessionExpired({ path }));
  }

  if (response.ok && shouldNotifyAdminMutation(method, path)) {
    queueMicrotask(() => notifyAdminChanged({ method, path }));
  }

  return response;
}
