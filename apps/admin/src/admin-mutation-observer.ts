let installed = false;

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

export function installAdminMutationObserver(): void {
  if (installed) return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = requestMethod(input, init);
    const path = requestPath(input);
    const response = await nativeFetch(input, init);

    if (
      response.ok &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
      path?.startsWith('/api/admin/') &&
      !path.startsWith('/api/admin/auth/') &&
      !path.startsWith('/api/admin/publish')
    ) {
      queueMicrotask(() => window.dispatchEvent(new Event('admin:data-mutated')));
    }

    return response;
  };
}
