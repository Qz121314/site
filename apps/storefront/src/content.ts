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
  featuredOrder: number;
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
  } | null;
};

export type PublicSite = {
  name: string;
  locationLabel: string;
  mediaBaseUrl: string;
  logoUrl: string | null;
  homeSectionLimit?: number;
  navigation: {
    showHot: boolean;
    showLatest: boolean;
    showMore: boolean;
    showFaq: boolean;
  };
  analytics: {
    ga4MeasurementId: string | null;
  };
};

export type CurrentPointerV1 = {
  schemaVersion: 1;
  contentVersion: string;
  manifestKey: string;
  sourceRevision: string;
  publishedAt: string;
};

export type ModuleReference = {
  contentVersion: string;
  manifestKey: string;
  sourceRevision: string;
  publishedAt: string;
};

export type CurrentPointerV2 = {
  schemaVersion: 2;
  contentVersion: string;
  publishedAt: string;
  site: ModuleReference;
  sectionsIndex: ModuleReference;
  faq: ModuleReference;
  sections: Record<string, ModuleReference>;
};

export type CurrentPointer = CurrentPointerV1 | CurrentPointerV2;

export type SiteSnapshot = {
  schemaVersion: 1 | 2;
  contentVersion: string;
  publishedAt: string;
  site: PublicSite;
};

export type HomeSnapshot = {
  schemaVersion: 1 | 2;
  contentVersion: string;
  publishedAt: string;
  sections: PublicSection[];
  allSections: PublicSection[];
  featuredProducts: PublicProductSummary[];
  latestProducts: PublicProductSummary[];
};

export type SectionSnapshot = {
  schemaVersion: 1 | 2;
  contentVersion: string;
  publishedAt: string;
  section: PublicSection;
  categories: PublicCategory[];
  tags: PublicTag[];
  products: PublicProductSummary[];
};

export type ProductSnapshot = {
  schemaVersion: 1 | 2;
  contentVersion: string;
  publishedAt: string;
  product: PublicProduct;
};

export type FaqSnapshot = {
  schemaVersion: 1 | 2;
  contentVersion: string;
  publishedAt: string;
  faqs: Array<{ id: string; title: string; body: string }>;
};

export type StorefrontBootstrap = {
  origin: string;
  pointer: CurrentPointer;
  site: SiteSnapshot;
  home: HomeSnapshot;
  sectionSnapshots: Record<string, SectionSnapshot>;
  productSectionIds: Record<string, string>;
};

export class PublicContentError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PublicContentError';
    this.code = code;
  }
}

type V2SiteSnapshot = {
  schemaVersion: 2;
  moduleKey: 'site';
  contentVersion: string;
  publishedAt: string;
  site: {
    name: string;
    locationLabel: string;
    /** Present only in older schema-v2 snapshots; runtime config is authoritative. */
    mediaBaseUrl?: string | null;
    logoObjectKey: string | null;
    homeSectionLimit: number;
    navigation: PublicSite['navigation'];
    analytics: PublicSite['analytics'];
  };
};

type V2SectionsIndexSnapshot = {
  schemaVersion: 2;
  moduleKey: 'sections-index';
  contentVersion: string;
  publishedAt: string;
  sections: Array<{
    id: string;
    slug: string;
    name: string;
    icon: {
      type: 'image' | 'icon';
      objectKey: string | null;
      value: string | null;
    };
    sortOrder: number;
  }>;
};

type V2ProductSummary = {
  id: string;
  slug: string;
  sectionId: string;
  title: string;
  serviceMode: 'online' | 'offline';
  address: string | null;
  category: { id: string | null; name: string | null };
  tags: Array<Pick<PublicTag, 'id' | 'name' | 'sortOrder'>>;
  coverObjectKey: string | null;
  isFeatured: boolean;
  featuredOrder: number;
  publishedAt: string | null;
  sortOrder: number;
};

type V2SectionSnapshot = {
  schemaVersion: 2;
  moduleKey: string;
  contentVersion: string;
  publishedAt: string;
  sectionId: string;
  categories: PublicCategory[];
  tags: PublicTag[];
  products: V2ProductSummary[];
};

type V2ProductSnapshot = {
  schemaVersion: 2;
  moduleKey: string;
  contentVersion: string;
  publishedAt: string;
  product: V2ProductSummary & {
    body: string;
    media: Array<{
      id: string;
      objectKey: string;
      width: number | null;
      height: number | null;
      altText: string | null;
      sortOrder: number;
    }>;
    cta: PublicProduct['cta'];
  };
};

type V2FaqSnapshot = {
  schemaVersion: 2;
  moduleKey: 'faq';
  contentVersion: string;
  publishedAt: string;
  faqs: Array<{ id: string; title: string; body: string; sortOrder?: number }>;
};

type V2DerivedHomeSnapshot = {
  schemaVersion: 2;
  pointerVersion: string;
  publishedAt: string;
  featuredProducts: V2ProductSummary[];
  latestProducts: V2ProductSummary[];
};

const VERSION_PATTERN = /^[A-Za-z0-9-]{12,180}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

async function discoverContentOrigin(signal?: AbortSignal): Promise<string | null> {
  const init: RequestInit = {
    method: 'GET',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (signal) init.signal = signal;

  try {
    const response = await fetch('/api/public/storefront/content-origin', init);
    if (!response.ok) return null;
    const value = (await response.json()) as unknown;
    if (!isRecord(value)) return null;
    return normalizeContentOrigin(
      typeof value.contentOrigin === 'string' ? value.contentOrigin : null,
    );
  } catch {
    return null;
  }
}

export async function resolveContentOrigin(signal?: AbortSignal): Promise<string> {
  const discovered = await discoverContentOrigin(signal);
  if (discovered) return discovered;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return window.location.origin;
    }
  }

  throw new PublicContentError(
    'CONTENT_ORIGIN_REQUIRED',
    'Public content has been published, but its R2 content domain is not available yet.',
  );
}

function assertContentVersion(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new PublicContentError(
      'INVALID_CONTENT_VERSION',
      'The published content version is invalid.',
    );
  }
}

function validModuleReference(value: unknown): value is ModuleReference {
  if (!isRecord(value)) return false;
  if (
    typeof value.contentVersion !== 'string' ||
    typeof value.manifestKey !== 'string' ||
    typeof value.sourceRevision !== 'string' ||
    typeof value.publishedAt !== 'string'
  ) {
    return false;
  }
  return VERSION_PATTERN.test(value.contentVersion);
}

function parsePointer(value: unknown): CurrentPointer {
  if (!isRecord(value)) {
    throw new PublicContentError(
      'INVALID_POINTER',
      'The published content pointer is invalid.',
    );
  }

  if (value.schemaVersion === 1) {
    if (
      typeof value.manifestKey !== 'string' ||
      typeof value.sourceRevision !== 'string' ||
      typeof value.publishedAt !== 'string'
    ) {
      throw new PublicContentError(
        'INVALID_POINTER',
        'The published content pointer is invalid.',
      );
    }
    assertContentVersion(value.contentVersion);
    return {
      schemaVersion: 1,
      contentVersion: value.contentVersion,
      manifestKey: value.manifestKey,
      sourceRevision: value.sourceRevision,
      publishedAt: value.publishedAt,
    };
  }

  if (
    value.schemaVersion !== 2 ||
    typeof value.publishedAt !== 'string' ||
    !validModuleReference(value.site) ||
    !validModuleReference(value.sectionsIndex) ||
    !validModuleReference(value.faq) ||
    !isRecord(value.sections)
  ) {
    throw new PublicContentError(
      'INVALID_POINTER',
      'The published content pointer is invalid.',
    );
  }
  assertContentVersion(value.contentVersion);
  const sections: Record<string, ModuleReference> = {};
  for (const [sectionId, reference] of Object.entries(value.sections)) {
    if (!sectionId || sectionId.length > 120 || !validModuleReference(reference)) {
      throw new PublicContentError(
        'INVALID_POINTER',
        'The published content pointer is invalid.',
      );
    }
    sections[sectionId] = reference;
  }
  return {
    schemaVersion: 2,
    contentVersion: value.contentVersion,
    publishedAt: value.publishedAt,
    site: value.site,
    sectionsIndex: value.sectionsIndex,
    faq: value.faq,
    sections,
  };
}

function assertV1Envelope(value: unknown, contentVersion: string): void {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.contentVersion !== contentVersion
  ) {
    throw new PublicContentError(
      'SNAPSHOT_VERSION_MISMATCH',
      'The published content snapshot is inconsistent.',
    );
  }
}

function assertV2Envelope(
  value: unknown,
  moduleKey: string,
  contentVersion: string,
): void {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.moduleKey !== moduleKey ||
    value.contentVersion !== contentVersion
  ) {
    throw new PublicContentError(
      'SNAPSHOT_VERSION_MISMATCH',
      'The published content module is inconsistent.',
    );
  }
}

function parseV2DerivedHome(
  value: unknown,
  pointerVersion: string,
): V2DerivedHomeSnapshot {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.pointerVersion !== pointerVersion ||
    typeof value.publishedAt !== 'string' ||
    !Array.isArray(value.featuredProducts) ||
    !Array.isArray(value.latestProducts)
  ) {
    throw new PublicContentError(
      'SNAPSHOT_VERSION_MISMATCH',
      'The published home summary is inconsistent.',
    );
  }
  return value as V2DerivedHomeSnapshot;
}

function normalizeTags(value: unknown): PublicProductSummary['tags'] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is PublicProductSummary['tags'][number] => {
    if (!isRecord(tag)) return false;
    return (
      typeof tag.id === 'string' &&
      typeof tag.name === 'string' &&
      typeof tag.sortOrder === 'number'
    );
  });
}

function normalizeV1Summary(product: PublicProductSummary): PublicProductSummary {
  const featuredOrder = (product as PublicProductSummary & { featuredOrder?: unknown })
    .featuredOrder;
  return {
    ...product,
    tags: normalizeTags((product as { tags?: unknown }).tags),
    featuredOrder: typeof featuredOrder === 'number' ? featuredOrder : 0,
  };
}

function normalizeV1HomeSnapshot(snapshot: HomeSnapshot): HomeSnapshot {
  return {
    ...snapshot,
    sections: Array.isArray(snapshot.sections) ? snapshot.sections : [],
    allSections: Array.isArray(snapshot.allSections) ? snapshot.allSections : [],
    featuredProducts: Array.isArray(snapshot.featuredProducts)
      ? snapshot.featuredProducts.map(normalizeV1Summary)
      : [],
    latestProducts: Array.isArray(snapshot.latestProducts)
      ? snapshot.latestProducts.map(normalizeV1Summary)
      : [],
  };
}

function normalizeV1SectionSnapshot(snapshot: SectionSnapshot): SectionSnapshot {
  return {
    ...snapshot,
    categories: Array.isArray(snapshot.categories) ? snapshot.categories : [],
    tags: Array.isArray(snapshot.tags) ? snapshot.tags : [],
    products: Array.isArray(snapshot.products)
      ? snapshot.products.map(normalizeV1Summary)
      : [],
  };
}

function normalizeV1ProductSnapshot(snapshot: ProductSnapshot): ProductSnapshot {
  const product = snapshot.product;
  return {
    ...snapshot,
    product: {
      ...normalizeV1Summary(product),
      body: product.body,
      media: Array.isArray(product.media) ? product.media : [],
      cta: product.cta,
    },
  };
}

export function publicContentUrl(origin: string, path: string): string {
  const normalized = normalizeContentOrigin(origin);
  if (!normalized) {
    throw new PublicContentError(
      'INVALID_CONTENT_ORIGIN',
      'The public content origin is invalid.',
    );
  }
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalized}/${normalizedPath}`;
}

function encodeObjectKey(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function mediaUrl(mediaBaseUrl: string, objectKey: string | null): string | null {
  return objectKey ? `${mediaBaseUrl}/${encodeObjectKey(objectKey)}` : null;
}

async function fetchJson(
  url: string,
  cache: RequestCache,
  signal?: AbortSignal,
): Promise<unknown> {
  const init: RequestInit = {
    method: 'GET',
    cache,
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  };
  if (signal) init.signal = signal;

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new PublicContentError(
      'CONTENT_UNAVAILABLE',
      'Published content could not be reached. Please try again shortly.',
    );
  }

  if (!response.ok) {
    throw new PublicContentError(
      response.status === 404 ? 'CONTENT_NOT_PUBLISHED' : 'CONTENT_UNAVAILABLE',
      response.status === 404
        ? 'No published content is available for this page yet.'
        : 'Published content is temporarily unavailable.',
    );
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    throw new PublicContentError(
      'INVALID_CONTENT_TYPE',
      'Published content returned an invalid response.',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new PublicContentError(
      'INVALID_JSON',
      'Published content returned invalid JSON.',
    );
  }
}

export async function loadCurrentPointer(
  origin: string,
  signal?: AbortSignal,
): Promise<CurrentPointer> {
  const value = await fetchJson(
    publicContentUrl(origin, 'public/current.json'),
    'no-cache',
    signal,
  );
  return parsePointer(value);
}

async function loadV1File<T>(
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
  assertV1Envelope(value, contentVersion);
  return value as T;
}

async function loadV2File<T>(
  origin: string,
  moduleKey: string,
  reference: ModuleReference,
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  assertContentVersion(reference.contentVersion);
  const value = await fetchJson(publicContentUrl(origin, path), 'force-cache', signal);
  assertV2Envelope(value, moduleKey, reference.contentVersion);
  return value as T;
}

function v2ModulePath(
  moduleKey: string,
  reference: ModuleReference,
  relativePath: string,
): string {
  if (moduleKey === 'site') {
    return `public/modules/site/${reference.contentVersion}/${relativePath}`;
  }
  if (moduleKey === 'sections-index') {
    return `public/modules/sections-index/${reference.contentVersion}/${relativePath}`;
  }
  if (moduleKey === 'faq') {
    return `public/modules/faq/${reference.contentVersion}/${relativePath}`;
  }
  const sectionId = moduleKey.startsWith('section:')
    ? moduleKey.slice('section:'.length)
    : '';
  if (!sectionId) {
    throw new PublicContentError(
      'INVALID_POINTER',
      'The published section module is invalid.',
    );
  }
  return `public/modules/sections/${encodeURIComponent(sectionId)}/${reference.contentVersion}/${relativePath}`;
}

function resolveV2Section(
  section: V2SectionsIndexSnapshot['sections'][number],
  mediaBaseUrl: string,
): PublicSection {
  return {
    id: section.id,
    slug: section.slug,
    name: section.name,
    icon: {
      type: section.icon.type,
      value:
        section.icon.type === 'image'
          ? mediaUrl(mediaBaseUrl, section.icon.objectKey)
          : section.icon.value,
    },
    sortOrder: section.sortOrder,
  };
}

function resolveV2Summary(
  product: V2ProductSummary,
  section: PublicSection,
  mediaBaseUrl: string,
): PublicProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    sectionId: product.sectionId,
    sectionSlug: section.slug,
    sectionName: section.name,
    title: product.title,
    serviceMode: product.serviceMode,
    address: product.address,
    category: product.category,
    tags: normalizeTags(product.tags),
    coverUrl: mediaUrl(mediaBaseUrl, product.coverObjectKey),
    isFeatured: product.isFeatured,
    featuredOrder: product.featuredOrder,
    publishedAt: product.publishedAt,
    sortOrder: product.sortOrder,
  };
}

async function loadV2SectionFile(
  origin: string,
  pointer: CurrentPointerV2,
  mediaBaseUrl: string,
  section: PublicSection,
  signal?: AbortSignal,
): Promise<SectionSnapshot> {
  const reference = pointer.sections[section.id];
  if (!reference) {
    throw new PublicContentError(
      'CONTENT_NOT_PUBLISHED',
      'This service section has not been published yet.',
    );
  }
  const moduleKey = `section:${section.id}`;
  const raw = await loadV2File<V2SectionSnapshot>(
    origin,
    moduleKey,
    reference,
    v2ModulePath(moduleKey, reference, 'section.json'),
    signal,
  );
  if (raw.sectionId !== section.id) {
    throw new PublicContentError(
      'SNAPSHOT_VERSION_MISMATCH',
      'The published section is inconsistent.',
    );
  }
  return {
    schemaVersion: 2,
    contentVersion: reference.contentVersion,
    publishedAt: raw.publishedAt,
    section,
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    products: Array.isArray(raw.products)
      ? raw.products.map((product) => resolveV2Summary(product, section, mediaBaseUrl))
      : [],
  };
}

function composeHomeProducts(
  rawProducts: V2ProductSummary[],
  sections: PublicSection[],
  mediaBaseUrl: string,
): PublicProductSummary[] {
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const products: PublicProductSummary[] = [];
  for (const product of rawProducts) {
    const section = sectionsById.get(product.sectionId);
    if (!section) continue;
    products.push(resolveV2Summary(product, section, mediaBaseUrl));
  }
  return products;
}

async function loadDerivedV2Home(
  origin: string,
  pointer: CurrentPointerV2,
  sections: PublicSection[],
  mediaBaseUrl: string,
  signal?: AbortSignal,
): Promise<Pick<HomeSnapshot, 'featuredProducts' | 'latestProducts'>> {
  const raw = parseV2DerivedHome(
    await fetchJson(
      publicContentUrl(
        origin,
        `public/home/${encodeURIComponent(pointer.contentVersion)}/home.json`,
      ),
      'force-cache',
      signal,
    ),
    pointer.contentVersion,
  );
  return {
    featuredProducts: composeHomeProducts(raw.featuredProducts, sections, mediaBaseUrl),
    latestProducts: composeHomeProducts(raw.latestProducts, sections, mediaBaseUrl),
  };
}

function indexBootstrapProducts(
  bootstrap: Pick<StorefrontBootstrap, 'home' | 'productSectionIds'>,
): void {
  for (const product of [
    ...bootstrap.home.featuredProducts,
    ...bootstrap.home.latestProducts,
  ]) {
    bootstrap.productSectionIds[product.id] = product.sectionId;
  }
}

async function loadV2Bootstrap(
  origin: string,
  pointer: CurrentPointerV2,
  signal?: AbortSignal,
): Promise<StorefrontBootstrap> {
  const [rawSite, rawIndex] = await Promise.all([
    loadV2File<V2SiteSnapshot>(
      origin,
      'site',
      pointer.site,
      v2ModulePath('site', pointer.site, 'site.json'),
      signal,
    ),
    loadV2File<V2SectionsIndexSnapshot>(
      origin,
      'sections-index',
      pointer.sectionsIndex,
      v2ModulePath('sections-index', pointer.sectionsIndex, 'sections.json'),
      signal,
    ),
  ]);

  // The runtime setting is authoritative. Published snapshots keep object keys only,
  // so changing the R2 custom domain never requires rebuilding the Storefront.
  const mediaBaseUrl = origin;
  const site: PublicSite = {
    name: rawSite.site.name,
    locationLabel: rawSite.site.locationLabel,
    mediaBaseUrl,
    logoUrl: mediaUrl(mediaBaseUrl, rawSite.site.logoObjectKey),
    homeSectionLimit: rawSite.site.homeSectionLimit,
    navigation: rawSite.site.navigation,
    analytics: rawSite.site.analytics,
  };
  const sections = rawIndex.sections.map((section) =>
    resolveV2Section(section, mediaBaseUrl),
  );
  const sectionSnapshots: Record<string, SectionSnapshot> = {};
  const productSectionIds: Record<string, string> = {};

  let featuredProducts: PublicProductSummary[] = [];
  let latestProducts: PublicProductSummary[] = [];
  try {
    const derivedHome = await loadDerivedV2Home(
      origin,
      pointer,
      sections,
      mediaBaseUrl,
      signal,
    );
    featuredProducts = derivedHome.featuredProducts;
    latestProducts = derivedHome.latestProducts;
  } catch (error) {
    if (signal?.aborted) throw error;
    const loadedSections = await Promise.all(
      sections.map(async (section) => {
        if (!pointer.sections[section.id]) return null;
        return loadV2SectionFile(origin, pointer, mediaBaseUrl, section, signal);
      }),
    );
    const allProducts: PublicProductSummary[] = [];
    for (const snapshot of loadedSections) {
      if (!snapshot) continue;
      sectionSnapshots[snapshot.section.id] = snapshot;
      for (const product of snapshot.products) {
        productSectionIds[product.id] = snapshot.section.id;
        allProducts.push(product);
      }
    }
    featuredProducts = allProducts
      .filter((product) => product.isFeatured)
      .sort(
        (left, right) =>
          left.featuredOrder - right.featuredOrder || left.sortOrder - right.sortOrder,
      )
      .slice(0, 30);
    latestProducts = [...allProducts]
      .sort((left, right) =>
        (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''),
      )
      .slice(0, 30);
  }

  const homeLimit = Math.max(1, Math.min(20, rawSite.site.homeSectionLimit || 5));
  const bootstrap: StorefrontBootstrap = {
    origin,
    pointer,
    site: {
      schemaVersion: 2,
      contentVersion: pointer.site.contentVersion,
      publishedAt: pointer.site.publishedAt,
      site,
    },
    home: {
      schemaVersion: 2,
      contentVersion: pointer.contentVersion,
      publishedAt: pointer.publishedAt,
      sections: sections.slice(0, homeLimit),
      allSections: sections,
      featuredProducts,
      latestProducts,
    },
    sectionSnapshots,
    productSectionIds,
  };
  indexBootstrapProducts(bootstrap);
  return bootstrap;
}

async function loadV1Bootstrap(
  origin: string,
  pointer: CurrentPointerV1,
  signal?: AbortSignal,
): Promise<StorefrontBootstrap> {
  const [site, rawHome] = await Promise.all([
    loadV1File<SiteSnapshot>(origin, pointer.contentVersion, 'site.json', signal),
    loadV1File<HomeSnapshot>(origin, pointer.contentVersion, 'home.json', signal),
  ]);
  return {
    origin,
    pointer,
    site,
    home: normalizeV1HomeSnapshot(rawHome),
    sectionSnapshots: {},
    productSectionIds: {},
  };
}

export async function loadStorefrontBootstrap(
  origin?: string,
  signal?: AbortSignal,
): Promise<StorefrontBootstrap> {
  const resolvedOrigin = origin
    ? normalizeContentOrigin(origin)
    : await resolveContentOrigin(signal);
  if (!resolvedOrigin) {
    throw new PublicContentError(
      'INVALID_CONTENT_ORIGIN',
      'The public content origin is invalid.',
    );
  }
  const pointer = await loadCurrentPointer(resolvedOrigin, signal);
  return pointer.schemaVersion === 2
    ? loadV2Bootstrap(resolvedOrigin, pointer, signal)
    : loadV1Bootstrap(resolvedOrigin, pointer, signal);
}

export async function loadSectionSnapshot(
  bootstrap: StorefrontBootstrap,
  sectionRef: string,
  signal?: AbortSignal,
): Promise<SectionSnapshot> {
  if (!sectionRef || sectionRef.length > 120) {
    throw new PublicContentError(
      'INVALID_SECTION',
      'The requested service section is invalid.',
    );
  }
  const section = bootstrap.home.allSections.find(
    (item) => item.id === sectionRef || item.slug === sectionRef,
  );
  if (!section) {
    throw new PublicContentError(
      'CONTENT_NOT_PUBLISHED',
      'This service section has not been published yet.',
    );
  }
  const sectionId = section.id;
  if (bootstrap.pointer.schemaVersion === 2) {
    const cached = bootstrap.sectionSnapshots[sectionId];
    if (cached) return cached;
    const snapshot = await loadV2SectionFile(
      bootstrap.origin,
      bootstrap.pointer,
      bootstrap.site.site.mediaBaseUrl,
      section,
      signal,
    );
    bootstrap.sectionSnapshots[sectionId] = snapshot;
    for (const product of snapshot.products) {
      bootstrap.productSectionIds[product.id] = sectionId;
    }
    return snapshot;
  }
  const snapshot = await loadV1File<SectionSnapshot>(
    bootstrap.origin,
    bootstrap.pointer.contentVersion,
    `sections/${encodeURIComponent(sectionId)}.json`,
    signal,
  );
  return normalizeV1SectionSnapshot(snapshot);
}

function findPublishedProduct(
  products: PublicProductSummary[],
  productRef: string,
): PublicProductSummary | null {
  const exactId = products.find((product) => product.id === productRef);
  if (exactId) return exactId;
  const slugMatches = products.filter((product) => product.slug === productRef);
  return slugMatches.length === 1 ? (slugMatches[0] ?? null) : null;
}

export async function loadProductSnapshot(
  bootstrap: StorefrontBootstrap,
  productRef: string,
  signal?: AbortSignal,
  sectionRef?: string | null,
): Promise<ProductSnapshot> {
  if (!productRef || productRef.length > 120 || (sectionRef && sectionRef.length > 120)) {
    throw new PublicContentError('INVALID_PRODUCT', 'The requested service is invalid.');
  }
  if (bootstrap.pointer.schemaVersion === 1) {
    let productId = productRef;
    if (sectionRef) {
      const section = await loadSectionSnapshot(bootstrap, sectionRef, signal);
      const product = findPublishedProduct(section.products, productRef);
      if (!product) {
        throw new PublicContentError(
          'CONTENT_NOT_PUBLISHED',
          'This service has not been published yet.',
        );
      }
      productId = product.id;
    } else {
      const product = findPublishedProduct(
        [...bootstrap.home.featuredProducts, ...bootstrap.home.latestProducts],
        productRef,
      );
      if (product) productId = product.id;
    }
    const snapshot = await loadV1File<ProductSnapshot>(
      bootstrap.origin,
      bootstrap.pointer.contentVersion,
      `products/${encodeURIComponent(productId)}.json`,
      signal,
    );
    return normalizeV1ProductSnapshot(snapshot);
  }

  let matchedProduct: PublicProductSummary | null = null;
  let section: PublicSection | null = null;

  if (sectionRef) {
    const sectionSnapshot = await loadSectionSnapshot(bootstrap, sectionRef, signal);
    matchedProduct = findPublishedProduct(sectionSnapshot.products, productRef);
    section = sectionSnapshot.section;
  } else {
    const snapshots = await Promise.all(
      bootstrap.home.allSections.map((item) =>
        loadSectionSnapshot(bootstrap, item.id, signal),
      ),
    );
    matchedProduct = findPublishedProduct(
      snapshots.flatMap((snapshot) => snapshot.products),
      productRef,
    );
    if (matchedProduct) {
      section =
        bootstrap.home.allSections.find(
          (item) => item.id === matchedProduct?.sectionId,
        ) ?? null;
    }
  }

  if (!matchedProduct || !section) {
    throw new PublicContentError(
      'CONTENT_NOT_PUBLISHED',
      'This service is not part of the current published section versions.',
    );
  }
  const reference = bootstrap.pointer.sections[section.id];
  if (!reference) {
    throw new PublicContentError(
      'CONTENT_NOT_PUBLISHED',
      'This service is not part of the current published section versions.',
    );
  }

  const moduleKey = `section:${section.id}`;
  const raw = await loadV2File<V2ProductSnapshot>(
    bootstrap.origin,
    moduleKey,
    reference,
    v2ModulePath(
      moduleKey,
      reference,
      `products/${encodeURIComponent(matchedProduct.id)}.json`,
    ),
    signal,
  );
  if (raw.product.id !== matchedProduct.id || raw.product.sectionId !== section.id) {
    throw new PublicContentError(
      'SNAPSHOT_VERSION_MISMATCH',
      'The published service is inconsistent.',
    );
  }
  const summary = resolveV2Summary(
    raw.product,
    section,
    bootstrap.site.site.mediaBaseUrl,
  );
  return {
    schemaVersion: 2,
    contentVersion: reference.contentVersion,
    publishedAt: raw.publishedAt,
    product: {
      ...summary,
      body: raw.product.body,
      media: Array.isArray(raw.product.media)
        ? raw.product.media.map((media) => ({
            id: media.id,
            url: mediaUrl(bootstrap.site.site.mediaBaseUrl, media.objectKey),
            width: media.width,
            height: media.height,
            altText: media.altText,
            sortOrder: media.sortOrder,
          }))
        : [],
      cta: raw.product.cta,
    },
  };
}

export async function loadFaqSnapshot(
  bootstrap: StorefrontBootstrap,
  signal?: AbortSignal,
): Promise<FaqSnapshot> {
  if (bootstrap.pointer.schemaVersion === 1) {
    return loadV1File<FaqSnapshot>(
      bootstrap.origin,
      bootstrap.pointer.contentVersion,
      'faq.json',
      signal,
    );
  }
  const reference = bootstrap.pointer.faq;
  return loadV2File<V2FaqSnapshot>(
    bootstrap.origin,
    'faq',
    reference,
    v2ModulePath('faq', reference, 'faq.json'),
    signal,
  );
}
