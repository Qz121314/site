type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RealtimeCta = {
  label: string;
  mode: 'customer_service' | 'link';
  path: string;
};

const PUBLIC_SNAPSHOT_PREFIXES = [
  '/public/versions/',
  '/public/modules/',
] as const;

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
  return pathname === '/public/current.json'
    || PUBLIC_SNAPSHOT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function productIdFromSnapshotPath(pathname: string): string | null {
  const modular = /^\/public\/modules\/sections\/[^/]+\/[^/]+\/products\/([^/]+)\.json$/u.exec(pathname);
  const legacy = /^\/public\/versions\/[^/]+\/products\/([^/]+)\.json$/u.exec(pathname);
  const encoded = modular?.[1] ?? legacy?.[1];
  if (!encoded) return null;
  try {
    const productId = decodeURIComponent(encoded);
    return productId && productId.length <= 100 ? productId : null;
  } catch {
    return null;
  }
}

function fallbackInput(
  input: RequestInfo | URL,
  fallbackUrl: string,
): RequestInfo | URL {
  return input instanceof Request ? new Request(fallbackUrl, input) : fallbackUrl;
}

function shouldFallbackResponse(response: Response, method: string): boolean {
  if (response.headers.get('cf-mitigated')?.toLowerCase() === 'challenge') return true;

  if (!response.ok) {
    return response.status === 401
      || response.status === 403
      || response.status === 408
      || response.status === 425
      || response.status === 429
      || response.status >= 500;
  }

  if (method === 'HEAD') return false;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return !contentType.includes('application/json');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseRealtimeCta(value: unknown): RealtimeCta | null {
  const result = asRecord(value);
  if (!result || result.available !== true) return null;
  if (
    typeof result.label !== 'string'
    || (result.mode !== 'customer_service' && result.mode !== 'link')
    || typeof result.path !== 'string'
    || !result.path.startsWith('/go/')
  ) {
    return null;
  }
  return {
    label: result.label,
    mode: result.mode,
    path: result.path,
  };
}

async function hydrateProductCta(
  response: Response,
  productId: string | null,
  originalFetch: FetchFunction,
  pageOrigin: string,
  signal: AbortSignal | undefined,
): Promise<Response> {
  if (!productId || !response.ok) return response;

  let snapshot: Record<string, unknown> | null = null;
  try {
    snapshot = asRecord(await response.clone().json());
  } catch {
    return response;
  }
  const product = asRecord(snapshot?.product);
  if (!snapshot || !product) return response;

  let cta: RealtimeCta | null = null;
  try {
    const ctaResponse = await originalFetch(
      `${pageOrigin}/api/public/storefront/cta/${encodeURIComponent(productId)}`,
      {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        ...(signal ? { signal } : {}),
      },
    );
    if (ctaResponse.ok) cta = parseRealtimeCta(await ctaResponse.json());
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');

  return new Response(
    JSON.stringify({ ...snapshot, product: { ...product, cta } }),
    {
      status: response.status,
      statusText: response.statusText,
      headers,
    },
  );
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
      !url
      || (method !== 'GET' && method !== 'HEAD')
      || !isPublicSnapshotPath(url.pathname)
    ) {
      return originalFetch(input, init);
    }

    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const productId = method === 'GET' ? productIdFromSnapshotPath(url.pathname) : null;

    if (url.origin === normalizedPageOrigin) {
      const response = await originalFetch(input, init);
      return hydrateProductCta(response, productId, originalFetch, normalizedPageOrigin, signal);
    }

    const sameOriginUrl = `${normalizedPageOrigin}${url.pathname}${url.search}`;
    const retryInput = fallbackInput(input, sameOriginUrl);
    const blocked = (blockedUntil.get(url.origin) ?? 0) > now();
    if (blocked) {
      const response = await originalFetch(retryInput, init);
      return hydrateProductCta(response, productId, originalFetch, normalizedPageOrigin, signal);
    }

    try {
      const response = await originalFetch(input, init);
      if (!shouldFallbackResponse(response, method)) {
        blockedUntil.delete(url.origin);
        return hydrateProductCta(response, productId, originalFetch, normalizedPageOrigin, signal);
      }

      blockedUntil.set(url.origin, now() + DIRECT_FAILURE_COOLDOWN_MS);
      const fallbackResponse = await originalFetch(retryInput, init);
      return hydrateProductCta(fallbackResponse, productId, originalFetch, normalizedPageOrigin, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      blockedUntil.set(url.origin, now() + DIRECT_FAILURE_COOLDOWN_MS);
      const fallbackResponse = await originalFetch(retryInput, init);
      return hydrateProductCta(fallbackResponse, productId, originalFetch, normalizedPageOrigin, signal);
    }
  };
}

export function installPublicContentFetchFallback(): void {
  if (typeof window === 'undefined') return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = createPublicContentFetch(originalFetch, window.location.origin) as typeof window.fetch;
}
