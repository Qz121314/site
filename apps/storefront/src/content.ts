export type PublicSection = {
  id: string;
  slug: string;
  name: string;
  icon: {
    type: 'image' | 'icon';
    value: string | null;
  };
  sortOrder: number;
};

export type PublicCategory = {
  id: string;
  sectionId: string;
  name: string;
  sortOrder: number;
};

export type PublicTag = {
  id: string;
  sectionId?: string;
  name: string;
  sortOrder: number;
};

export type PublicProductSummary = {
  id: string;
  slug: string;
  sectionId: string;
  sectionSlug: string;
  sectionName: string;
  title: string;
  serviceMode: 'online' | 'offline';
  address: string | null;
  category: {
    id: string | null;
    name: string | null;
  };
  tags: Array<Pick<PublicTag, 'id' | 'name' | 'sortOrder'>>;
  coverUrl: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
  sortOrder: number;
};

export type PublicProduct = PublicProductSummary & {
  body: string;
  media: Array<{
    id: string;
    url: string | null;
    width: number | null;
    height: number | null;
    altText: string | null;
    sortOrder: number;
  }>;
  cta: {
    label: string;
    mode: 'customer_service' | 'link';
    path: string;
  };
};

export type PublicSite = {
  name: string;
  locationLabel: string;
  mediaBaseUrl: string;
  logoUrl: string | null;
  navigation: {
    showHot: boolean;
    showLatest: boolean;
    showMore: boolean;
    showMessages: boolean;
    showFaq: boolean;
  };
  analytics: {
    ga4MeasurementId: string | null;
    facebookPixelId: string | null;
  };
  affiliate: {
    enabled: boolean;
    platform: string | null;
  };
};

export type CurrentPointer = {
  schemaVersion: 1;
  contentVersion: string;
  manifestKey: string;
  sourceRevision: string;
  publishedAt: string;
};

export type SiteSnapshot = {
  schemaVersion: 1;
  contentVersion: string;
  publishedAt: string;
  site: PublicSite;
};

export type HomeSnapshot = {
  schemaVersion: 1;
  contentVersion: string;
  publishedAt: string;
  sections: PublicSection[];
  allSections: PublicSection[];
  featuredProducts: PublicProductSummary[];
  latestProducts: PublicProductSummary[];
};

export type SectionSnapshot = {
  schemaVersion: 1;
  contentVersion: string;
  publishedAt: string;
  section: PublicSection;
  categories: PublicCategory[];
  tags: PublicTag[];
  products: PublicProductSummary[];
};

export type ProductSnapshot = {
  schemaVersion: 1;
  contentVersion: string;
  publishedAt: string;
  product: PublicProduct;
};

export type FaqSnapshot = {
  schemaVersion: 1;
  contentVersion: string;
  publishedAt: string;
  faqs: Array<{ id: string; title: string; body: string }>;
};

export type StorefrontBootstrap = {
  origin: string;
  pointer: CurrentPointer;
  site: SiteSnapshot;
  home: HomeSnapshot;
};

export class PublicContentError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PublicContentError';
    this.code = code;
  }
}

const VERSION_PATTERN = /^[A-Za-z0-9-]{12,180}$/;

export function normalizeContentOrigin(value: string | undefined | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function resolveContentOrigin(): string {
  const configured = normalizeContentOrigin(import.meta.env?.VITE_PUBLIC_CONTENT_ORIGIN);
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return window.location.origin;
    }
  }

  throw new PublicContentError(
    'CONTENT_ORIGIN_REQUIRED',
    'Public content is not configured yet. Please try again later.',
  );
}

function assertContentVersion(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new PublicContentError('INVALID_CONTENT_VERSION', 'The published content version is invalid.');
  }
}

function assertPointer(value: unknown): asserts value is CurrentPointer {
  if (!value || typeof value !== 'object') {
    throw new PublicContentError('INVALID_POINTER', 'The published content pointer is invalid.');
  }
  const pointer = value as Partial<CurrentPointer>;
  if (
    pointer.schemaVersion !== 1 ||
    typeof pointer.manifestKey !== 'string' ||
    typeof pointer.sourceRevision !== 'string' ||
    typeof pointer.publishedAt !== 'string'
  ) {
    throw new PublicContentError('INVALID_POINTER', 'The published content pointer is invalid.');
  }
  assertContentVersion(pointer.contentVersion);
}

function assertEnvelope(value: unknown, contentVersion: string): asserts value is { schemaVersion: 1; contentVersion: string } {
  if (!value || typeof value !== 'object') {
    throw new PublicContentError('INVALID_SNAPSHOT', 'The published content snapshot is invalid.');
  }
  const envelope = value as { schemaVersion?: unknown; contentVersion?: unknown };
  if (envelope.schemaVersion !== 1 || envelope.contentVersion !== contentVersion) {
    throw new PublicContentError('SNAPSHOT_VERSION_MISMATCH', 'The published content snapshot is inconsistent.');
  }
}

export function publicContentUrl(origin: string, path: string): string {
  const normalized = normalizeContentOrigin(origin);
  if (!normalized) {
    throw new PublicContentError('INVALID_CONTENT_ORIGIN', 'The public content origin is invalid.');
  }
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalized}/${normalizedPath}`;
}

async function fetchJson(url: string, cache: RequestCache, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      cache,
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new PublicContentError('CONTENT_UNAVAILABLE', 'Published content is temporarily unavailable.');
  }

  if (!response.ok) {
    throw new PublicContentError(
      response.status === 404 ? 'CONTENT_NOT_PUBLISHED' : 'CONTENT_UNAVAILABLE',
      response.status === 404
        ? 'No storefront version has been published yet.'
        : 'Published content is temporarily unavailable.',
    );
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    throw new PublicContentError('INVALID_CONTENT_TYPE', 'Published content returned an invalid response.');
  }

  try {
    return await response.json();
  } catch {
    throw new PublicContentError('INVALID_JSON', 'Published content returned invalid JSON.');
  }
}

export async function loadCurrentPointer(
  origin = resolveContentOrigin(),
  signal?: AbortSignal,
): Promise<CurrentPointer> {
  const value = await fetchJson(publicContentUrl(origin, 'public/current.json'), 'no-cache', signal);
  assertPointer(value);
  return value;
}

async function loadVersionFile<T extends { schemaVersion: 1; contentVersion: string }>(
  origin: string,
  contentVersion: string,
  relativePath: string,
  signal?: AbortSignal,
): Promise<T> {
  assertContentVersion(contentVersion);
  const value = await fetchJson(
    publicContentUrl(origin, `public/versions/${contentVersion}/${relativePath}`),
    'force-cache',
    signal,
  );
  assertEnvelope(value, contentVersion);
  return value as T;
}

export async function loadStorefrontBootstrap(
  origin = resolveContentOrigin(),
  signal?: AbortSignal,
): Promise<StorefrontBootstrap> {
  const normalizedOrigin = normalizeContentOrigin(origin);
  if (!normalizedOrigin) {
    throw new PublicContentError('INVALID_CONTENT_ORIGIN', 'The public content origin is invalid.');
  }
  const pointer = await loadCurrentPointer(normalizedOrigin, signal);
  const [site, home] = await Promise.all([
    loadVersionFile<SiteSnapshot>(normalizedOrigin, pointer.contentVersion, 'site.json', signal),
    loadVersionFile<HomeSnapshot>(normalizedOrigin, pointer.contentVersion, 'home.json', signal),
  ]);
  return { origin: normalizedOrigin, pointer, site, home };
}

export function loadSectionSnapshot(
  origin: string,
  contentVersion: string,
  sectionId: string,
  signal?: AbortSignal,
): Promise<SectionSnapshot> {
  if (!sectionId || sectionId.length > 120) {
    return Promise.reject(new PublicContentError('INVALID_SECTION', 'The requested service section is invalid.'));
  }
  return loadVersionFile<SectionSnapshot>(
    origin,
    contentVersion,
    `sections/${encodeURIComponent(sectionId)}.json`,
    signal,
  );
}

export function loadProductSnapshot(
  origin: string,
  contentVersion: string,
  productId: string,
  signal?: AbortSignal,
): Promise<ProductSnapshot> {
  if (!productId || productId.length > 120) {
    return Promise.reject(new PublicContentError('INVALID_PRODUCT', 'The requested service is invalid.'));
  }
  return loadVersionFile<ProductSnapshot>(
    origin,
    contentVersion,
    `products/${encodeURIComponent(productId)}.json`,
    signal,
  );
}

export function loadFaqSnapshot(
  origin: string,
  contentVersion: string,
  signal?: AbortSignal,
): Promise<FaqSnapshot> {
  return loadVersionFile<FaqSnapshot>(origin, contentVersion, 'faq.json', signal);
}
