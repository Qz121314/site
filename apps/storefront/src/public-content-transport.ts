type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const PUBLIC_SNAPSHOT_PREFIXES = ['/public/versions/', '/public/modules/'] as const;

const DIRECT_FAILURE_COOLDOWN_MS = 5 * 60_000;

function normalizePageOrigin(value: string): string {
  return new URL(value).origin;
}

function requestUrl(input: RequestInfo | URL, pageOrigin: string): URL | null {
  try {
    if (input instanceof Request) return new URL(input.url);
    if (input instanceof URL) return new URL(input.toString());
    return new URL(input, pageOrigin);
  } catch {
    return null;
  }
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  return method.toUpperCase();
}

function isPublicSnapshotPath(pathname: string): boolean {
  return (
    pathname === '/public/current.json' ||
    PUBLIC_SNAPSHOT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function fallbackInput(input: RequestInfo | URL, fallbackUrl: string): RequestInfo | URL {
  return input instanceof Request ? new Request(fallbackUrl, input) : fallbackUrl;
}

function shouldFallbackResponse(response: Response, method: string): boolean {
  if (response.headers.get('cf-mitigated')?.toLowerCase() === 'challenge') return true;

  if (!response.ok) {
    return (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500
    );
  }

  if (method === 'HEAD') return false;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return !contentType.includes('application/json');
}

export function createPublicContentFetch(
  originalFetch: FetchFunction,
  pageOrigin: string,
  now: () => number = Date.now,
): FetchFunction {
  const normalizedPageOrigin = normalizePageOrigin(pageOrigin);
  const blockedUntil = new Map<string, number>();

  return async (input, init) => {
    const url = requestUrl(input, normalizedPageOrigin);
    const method = requestMethod(input, init);
    if (
      !url ||
      (method !== 'GET' && method !== 'HEAD') ||
      !isPublicSnapshotPath(url.pathname)
    ) {
      return originalFetch(input, init);
    }

    if (url.origin === normalizedPageOrigin) {
      return originalFetch(input, init);
    }

    const sameOriginUrl = `${normalizedPageOrigin}${url.pathname}${url.search}`;
    const retryInput = fallbackInput(input, sameOriginUrl);
    const blocked = (blockedUntil.get(url.origin) ?? 0) > now();
    if (blocked) return originalFetch(retryInput, init);

    try {
      const response = await originalFetch(input, init);
      if (!shouldFallbackResponse(response, method)) {
        blockedUntil.delete(url.origin);
        return response;
      }

      blockedUntil.set(url.origin, now() + DIRECT_FAILURE_COOLDOWN_MS);
      return originalFetch(retryInput, init);
    } catch (error) {
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      if (signal?.aborted) throw error;
      blockedUntil.set(url.origin, now() + DIRECT_FAILURE_COOLDOWN_MS);
      return originalFetch(retryInput, init);
    }
  };
}

export function installPublicContentFetchFallback(): void {
  if (typeof window === 'undefined') return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = createPublicContentFetch(
    originalFetch,
    window.location.origin,
  ) as typeof window.fetch;
}
