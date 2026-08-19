import {
  PublicContentError,
  type PublicProductSummary,
  type StorefrontBootstrap,
} from './content';

type DerivedSearchProduct = Omit<
  PublicProductSummary,
  'sectionSlug' | 'sectionName' | 'coverUrl'
>;

type DerivedSearchSnapshot = {
  schemaVersion: 2;
  pointerVersion: string;
  publishedAt: string;
  products: DerivedSearchProduct[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mediaObjectUrl(
  mediaBaseUrl: string,
  objectKey: string | null | undefined,
) {
  const base = mediaBaseUrl.replace(/\/+$/u, '');
  if (!base || !objectKey || objectKey.includes('..')) return null;
  const segments = objectKey.split('/');
  if (segments.some((segment) => !segment)) return null;
  return `${base}/${segments.map(encodeURIComponent).join('/')}`;
}

function parseSearchSnapshot(
  value: unknown,
  pointerVersion: string,
): DerivedSearchSnapshot {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.pointerVersion !== pointerVersion ||
    typeof value.publishedAt !== 'string' ||
    !Array.isArray(value.products)
  ) {
    throw new PublicContentError(
      'INVALID_SEARCH_INDEX',
      'Published search content returned an invalid response.',
    );
  }
  return value as DerivedSearchSnapshot;
}

export async function loadBrowseSearchProducts(
  bootstrap: StorefrontBootstrap,
  signal?: AbortSignal,
): Promise<PublicProductSummary[]> {
  const pointerVersion = bootstrap.pointer.contentVersion;
  let response: Response;
  try {
    response = await fetch(
      `/api/public/storefront/search-index/${encodeURIComponent(pointerVersion)}`,
      {
        method: 'GET',
        cache: 'force-cache',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        ...(signal ? { signal } : {}),
      },
    );
  } catch {
    throw new PublicContentError(
      'CONTENT_UNAVAILABLE',
      'Published search content could not be reached.',
    );
  }

  if (!response.ok) {
    throw new PublicContentError(
      response.status === 404 ? 'CONTENT_NOT_PUBLISHED' : 'CONTENT_UNAVAILABLE',
      response.status === 404
        ? 'Published search content is not available yet.'
        : 'Published search content is temporarily unavailable.',
    );
  }

  let snapshot: DerivedSearchSnapshot;
  try {
    snapshot = parseSearchSnapshot(await response.json(), pointerVersion);
  } catch (error) {
    if (error instanceof PublicContentError) throw error;
    throw new PublicContentError(
      'INVALID_JSON',
      'Published search content returned invalid JSON.',
    );
  }

  const sectionsById = new Map(
    bootstrap.home.allSections.map((section) => [section.id, section]),
  );

  return snapshot.products.flatMap((product) => {
    const section = sectionsById.get(product.sectionId);
    if (!section) return [];
    return [
      {
        ...product,
        sectionSlug: section.slug,
        sectionName: section.name,
        coverUrl: mediaObjectUrl(
          bootstrap.site.site.mediaBaseUrl,
          product.coverObjectKey,
        ),
      },
    ];
  });
}
