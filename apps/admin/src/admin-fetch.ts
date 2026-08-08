export type AdminMutationDetail = {
  method: string;
  path: string;
};

export type AdminSessionExpiredDetail = {
  path: string;
};

export const ADMIN_SESSION_EXPIRED_EVENT = 'admin:session-expired';

const ADMIN_MUTATION_EVENT = 'admin:data-mutated';
const ADMIN_MUTATION_DEBOUNCE_MS = 200;
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SECTION_PUBLISH_SOURCE_PATH = /^\/api\/admin\/sections(?:\/|$)/u;

let pendingMutationDetail: AdminMutationDetail | null = null;
let mutationNotificationTimer: ReturnType<typeof setTimeout> | null = null;

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

function isPublishSourcePath(path: string): boolean {
  if (path === '/api/admin/settings/media-domain/test') return false;
  if (path.startsWith('/api/admin/settings')) return true;
  if (path.startsWith('/api/admin/media')) return true;
  if (path.startsWith('/api/admin/faqs')) return true;
  if (!SECTION_PUBLISH_SOURCE_PATH.test(path)) return false;

  // Conversion groups and targets are resolved live by the public CTA routes and are
  // intentionally excluded from immutable storefront snapshots.
  return !path.includes('/conversion-groups');
}

export function shouldNotifyAdminMutation(method: string, path: string | null): path is string {
  const normalizedMethod = method.toUpperCase();
  return (
    MUTATION_METHODS.has(normalizedMethod) &&
    path !== null &&
    isPublishSourcePath(path)
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
  pendingMutationDetail = detail;
  if (mutationNotificationTimer !== null) clearTimeout(mutationNotificationTimer);
  mutationNotificationTimer = setTimeout(() => {
    mutationNotificationTimer = null;
    const pending = pendingMutationDetail;
    pendingMutationDetail = null;
    if (pending) window.dispatchEvent(new CustomEvent(ADMIN_MUTATION_EVENT, { detail: pending }));
  }, ADMIN_MUTATION_DEBOUNCE_MS);
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
    notifyAdminChanged({ method, path });
  }

  return response;
}
