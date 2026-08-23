import {
  PublicContentError,
  findRememberedProduct,
  loadV1File,
  loadV2File,
  loadV2SectionFile,
  mediaUrl,
  normalizeV1ProductSnapshot,
  normalizeV1SectionSnapshot,
  rememberStorefrontProducts,
  resolveV2Summary,
  v2ModulePath,
  type FaqSnapshot,
  type ProductSnapshot,
  type PublicProductSummary,
  type PublicSection,
  type SectionSnapshot,
  type StorefrontBootstrap,
  type V2FaqSnapshot,
  type V2ProductSnapshot,
} from './content';

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
    rememberStorefrontProducts(bootstrap, snapshot.products);
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
    section =
      bootstrap.home.allSections.find(
        (item) => item.id === sectionRef || item.slug === sectionRef,
      ) ?? null;
    if (!section) {
      throw new PublicContentError(
        'CONTENT_NOT_PUBLISHED',
        'This service section has not been published yet.',
      );
    }
    matchedProduct = findRememberedProduct(bootstrap, section.id, productRef);
    if (!matchedProduct) {
      const sectionSnapshot = await loadSectionSnapshot(bootstrap, sectionRef, signal);
      matchedProduct = findPublishedProduct(sectionSnapshot.products, productRef);
      section = sectionSnapshot.section;
    }
  } else {
    throw new PublicContentError(
      'INVALID_PRODUCT',
      'Section context is required for published service details.',
    );
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
