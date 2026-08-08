type AdminMutationDetail = {
  method: string;
  path: string;
};

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

function shouldNotify(method: string, path: string | null): path is string {
  return (
    MUTATION_METHODS.has(method) &&
    path?.startsWith('/api/admin/') === true &&
    !path.startsWith('/api/admin/auth/') &&
    !path.startsWith('/api/admin/publish') &&
    path !== '/api/admin/settings/media-domain/test'
  );
}

export function notifyAdminChanged(detail: AdminMutationDetail): void {
  window.dispatchEvent(new CustomEvent('admin:data-mutated', { detail }));
}

export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = requestMethod(input, init);
  const path = requestPath(input);
  const response = await fetch(input, init);

  if (response.ok && shouldNotify(method, path)) {
    queueMicrotask(() => notifyAdminChanged({ method, path }));
  }

  return response;
}
