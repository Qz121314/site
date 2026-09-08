type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type JsonRecord = Record<string, unknown>;
type NowFunction = () => number;

const PUBLIC_SNAPSHOT_PREFIXES = [
  '/public/bootstrap/',
  '/public/versions/',
  '/public/modules/',
] as const;
const STOREFRONT_BOOTSTRAP_PATH = '/api/public/storefront/bootstrap';
const CURRENT_POINTER_PATH = '/public/current.json';
const LEGACY_BOOTSTRAP_PATHS = new Set([
  '/api/public/storefront/media-base-url',
  '/api/public/theme',
  '/api/public/bottom-navigation/',
]);
const DIRECT_FAILURE_COOLDOWN_MS = 5 * 60_000;
const VERSION_PATTERN = /^[A-Za-z0-9-]{12,180}$/;

// Keep these synchronized with the published protocol descriptor. A contract test
// ties the browser reader to apps/worker/src/publishing/storefront-bootstrap-protocol.json.
export const STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT = 4;
export const STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_MIN_READABLE = 4;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOrigin(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
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
    pathname === CURRENT_POINTER_PATH ||
    PUBLIC_SNAPSHOT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function fallbackInput(
  input: RequestInfo | URL,
  sameOriginUrl: string,
): RequestInfo | URL {
  return input instanceof Request ? new Request(sameOriginUrl, input) : sameOriginUrl;
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

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function parseValidatedJsonResponse(response: Response): Promise<unknown> {
  if (response.headers.get('cf-mitigated')?.toLowerCase() === 'challenge') {
    throw new Error('DIRECT_BOOTSTRAP_CHALLENGE');
  }
  if (!response.ok) throw new Error(`DIRECT_BOOTSTRAP_HTTP_${response.status}`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('DIRECT_BOOTSTRAP_CONTENT_TYPE');
  }
  try {
    return await response.clone().json();
  } catch {
    throw new Error('DIRECT_BOOTSTRAP_INVALID_JSON');
  }
}

function validModuleReference(value: unknown): value is JsonRecord {
  return (
    isRecord(value) &&
    typeof value.contentVersion === 'string' &&
    VERSION_PATTERN.test(value.contentVersion) &&
    typeof value.manifestKey === 'string' &&
    typeof value.sourceRevision === 'string' &&
    typeof value.publishedAt === 'string'
  );
}

function validPointer(value: unknown): value is JsonRecord {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    typeof value.contentVersion !== 'string' ||
    !VERSION_PATTERN.test(value.contentVersion) ||
    typeof value.publishedAt !== 'string' ||
    !validModuleReference(value.site) ||
    !validModuleReference(value.sectionsIndex) ||
    !validModuleReference(value.faq) ||
    !isRecord(value.sections)
  ) {
    return false;
  }
  return Object.values(value.sections).every(validModuleReference);
}

function validProtocol(value: unknown, schemaVersion: number): boolean {
  if (
    !isRecord(value) ||
    value.schemaVersion !== schemaVersion ||
    typeof value.minReadableSchemaVersion !== 'number' ||
    !Number.isInteger(value.minReadableSchemaVersion) ||
    value.minReadableSchemaVersion < 1 ||
    value.minReadableSchemaVersion > schemaVersion ||
    !Array.isArray(value.capabilities) ||
    value.capabilities.some((capability) => typeof capability !== 'string' || !capability)
  ) {
    return false;
  }
  return schemaVersion >= STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_MIN_READABLE;
}

function validSiteEnvelope(value: unknown, pointer: JsonRecord): value is JsonRecord {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.moduleKey !== 'site' ||
    !isRecord(pointer.site) ||
    value.contentVersion !== pointer.site.contentVersion ||
    !isRecord(value.site) ||
    !isRecord(value.site.runtime)
  ) {
    return false;
  }
  const runtime = value.site.runtime;
  const navigation = isRecord(value.site.navigation) ? value.site.navigation : null;
  return (
    (typeof runtime.mediaBaseUrl === 'string' || runtime.mediaBaseUrl === null) &&
    isRecord(runtime.theme) &&
    Array.isArray(runtime.bottomNavigation) &&
    Boolean(navigation && Array.isArray(navigation.messageArticles))
  );
}

function validSectionsEnvelope(value: unknown, pointer: JsonRecord): value is JsonRecord {
  return (
    isRecord(value) &&
    value.schemaVersion === 2 &&
    value.moduleKey === 'sections-index' &&
    isRecord(pointer.sectionsIndex) &&
    value.contentVersion === pointer.sectionsIndex.contentVersion &&
    Array.isArray(value.sections)
  );
}

function validHomeEnvelope(value: unknown, pointerVersion: string): value is JsonRecord {
  return (
    isRecord(value) &&
    value.schemaVersion === 2 &&
    value.pointerVersion === pointerVersion &&
    typeof value.publishedAt === 'string' &&
    Array.isArray(value.featuredProducts) &&
    Array.isArray(value.latestProducts)
  );
}

function directBootstrapBundle(pointer: unknown, value: unknown): JsonRecord | null {
  if (!validPointer(pointer) || !isRecord(value)) return null;
  if (
    typeof value.schemaVersion !== 'number' ||
    !Number.isInteger(value.schemaVersion) ||
    value.schemaVersion < STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_MIN_READABLE ||
    value.schemaVersion > STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT ||
    !validProtocol(value.protocol, value.schemaVersion) ||
    value.pointerVersion !== pointer.contentVersion ||
    !validSiteEnvelope(value.site, pointer) ||
    !validSectionsEnvelope(value.sectionsIndex, pointer) ||
    !validHomeEnvelope(value.home, pointer.contentVersion as string)
  ) {
    return null;
  }
  const siteEnvelope = value.site;
  const site = siteEnvelope.site as JsonRecord;
  const runtime = site.runtime as JsonRecord;
  return {
    pointer,
    site: siteEnvelope,
    sectionsIndex: value.sectionsIndex,
    home: value.home,
    mediaBaseUrl: runtime.mediaBaseUrl,
    theme: runtime.theme,
    bottomNavigation: runtime.bottomNavigation,
  };
}

function validWorkerBootstrapBundle(value: unknown): value is JsonRecord {
  if (!isRecord(value) || !validPointer(value.pointer)) return false;
  const pointer = value.pointer;
  return (
    validSiteEnvelope(value.site, pointer) &&
    validSectionsEnvelope(value.sectionsIndex, pointer) &&
    validHomeEnvelope(value.home, pointer.contentVersion as string) &&
    (typeof value.mediaBaseUrl === 'string' || value.mediaBaseUrl === null) &&
    isRecord(value.theme) &&
    Array.isArray(value.bottomNavigation)
  );
}

async function loadDirectBootstrap(
  originalFetch: FetchFunction,
  directOrigin: string,
  signal?: AbortSignal,
): Promise<JsonRecord> {
  const pointerResponse = await originalFetch(`${directOrigin}${CURRENT_POINTER_PATH}`, {
    method: 'GET',
    cache: 'no-cache',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  const pointer = await parseValidatedJsonResponse(pointerResponse);
  if (!validPointer(pointer)) throw new Error('DIRECT_BOOTSTRAP_POINTER_INVALID');

  const bootstrapResponse = await originalFetch(
    `${directOrigin}/public/bootstrap/${encodeURIComponent(pointer.contentVersion as string)}/bootstrap.json`,
    {
      method: 'GET',
      cache: 'force-cache',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    },
  );
  const bootstrap = await parseValidatedJsonResponse(bootstrapResponse);
  const bundle = directBootstrapBundle(pointer, bootstrap);
  if (!bundle) throw new Error('DIRECT_BOOTSTRAP_PROTOCOL_INVALID');
  return bundle;
}

function configuredDirectOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  return normalizeOrigin(import.meta.env.VITE_PUBLIC_CONTENT_ORIGIN);
}

export function createPublicContentFetch(
  originalFetch: FetchFunction,
  pageOrigin: string,
  now: NowFunction = Date.now,
  publicContentOrigin: string | null = null,
): FetchFunction {
  const normalizedPageOrigin = normalizeOrigin(pageOrigin) ?? pageOrigin;
  const normalizedDirectOrigin = normalizeOrigin(publicContentOrigin);
  const blockedUntil = new Map<string, number>();
  let bootstrapRecoveryClosed = false;

  return async (input, init) => {
    const url = requestUrl(input, normalizedPageOrigin);
    const method = requestMethod(input, init);
    if (!url || (method !== 'GET' && method !== 'HEAD')) {
      return originalFetch(input, init);
    }

    if (
      bootstrapRecoveryClosed &&
      url.origin === normalizedPageOrigin &&
      (url.pathname === CURRENT_POINTER_PATH || LEGACY_BOOTSTRAP_PATHS.has(url.pathname))
    ) {
      return jsonResponse(
        { available: false, code: 'PUBLISHED_BOOTSTRAP_UNAVAILABLE' },
        503,
      );
    }

    if (
      method === 'GET' &&
      url.origin === normalizedPageOrigin &&
      url.pathname === STOREFRONT_BOOTSTRAP_PATH
    ) {
      const signal =
        init?.signal ?? (input instanceof Request ? input.signal : undefined);
      if (normalizedDirectOrigin && normalizedDirectOrigin !== normalizedPageOrigin) {
        try {
          const directBundle = await loadDirectBootstrap(
            originalFetch,
            normalizedDirectOrigin,
            signal ?? undefined,
          );
          return jsonResponse(directBundle);
        } catch (error) {
          if (signal?.aborted) throw error;
        }
      }

      try {
        const fallbackResponse = await originalFetch(input, init);
        const fallbackValue = await parseValidatedJsonResponse(fallbackResponse);
        if (validWorkerBootstrapBundle(fallbackValue)) return fallbackResponse;
      } catch (error) {
        if (signal?.aborted) throw error;
      }

      bootstrapRecoveryClosed = true;
      return jsonResponse(
        { available: false, code: 'PUBLISHED_BOOTSTRAP_UNAVAILABLE' },
        503,
      );
    }

    if (!isPublicSnapshotPath(url.pathname)) return originalFetch(input, init);
    if (url.origin === normalizedPageOrigin) return originalFetch(input, init);

    const sameOriginUrl = `${normalizedPageOrigin}${url.pathname}${url.search}`;
    const retryInput = fallbackInput(input, sameOriginUrl);
    const blocked = blockedUntil.get(url.origin) ?? 0;
    if (blocked > now()) return originalFetch(retryInput, init);

    try {
      const response = await originalFetch(input, init);
      if (!shouldFallbackResponse(response, method)) {
        blockedUntil.delete(url.origin);
        return response;
      }
      blockedUntil.set(url.origin, now() + DIRECT_FAILURE_COOLDOWN_MS);
      return originalFetch(retryInput, init);
    } catch (error) {
      const signal =
        init?.signal ?? (input instanceof Request ? input.signal : undefined);
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
    Date.now,
    configuredDirectOrigin(),
  ) as typeof window.fetch;
}
