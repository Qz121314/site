import type { APIRequestContext } from '@playwright/test';

type PublishedProductRoute = {
  sectionHref: string;
  productHref: string;
};

type PublishedSection = {
  id: string;
};

type PublishedProduct = {
  id: string;
  sectionId: string;
};

type SectionReference = {
  contentVersion: string;
};

type BootstrapPayload = {
  pointer?: {
    schemaVersion?: number;
    sections?: Record<string, SectionReference>;
  };
  sectionsIndex?: {
    sections?: PublishedSection[];
  };
  home?: {
    featuredProducts?: PublishedProduct[];
    latestProducts?: PublishedProduct[];
  };
};

type SectionPayload = {
  products?: PublishedProduct[];
};

function routeFor(sectionId: string, productId: string): PublishedProductRoute {
  const sectionRef = encodeURIComponent(sectionId);
  const productRef = encodeURIComponent(productId);
  return {
    sectionHref: `/sections/${sectionRef}/`,
    productHref: `/sections/${sectionRef}/products/${productRef}/`,
  };
}

function firstProductRoute(
  sections: PublishedSection[],
  products: PublishedProduct[],
): PublishedProductRoute | null {
  const sectionIds = new Set(sections.map((section) => section.id));
  const product = products.find(
    (candidate) =>
      typeof candidate?.id === 'string' &&
      candidate.id.length > 0 &&
      typeof candidate.sectionId === 'string' &&
      sectionIds.has(candidate.sectionId),
  );
  return product ? routeFor(product.sectionId, product.id) : null;
}

export async function findPublishedProductRoute(
  request: APIRequestContext,
): Promise<PublishedProductRoute | null> {
  const bootstrapResponse = await request.get('/api/public/storefront/bootstrap', {
    headers: { 'cache-control': 'no-cache' },
  });
  if (!bootstrapResponse.ok()) {
    throw new Error(
      `Storefront bootstrap is unavailable during production acceptance (${bootstrapResponse.status()}).`,
    );
  }

  const bootstrap = (await bootstrapResponse.json()) as BootstrapPayload;
  const sections = Array.isArray(bootstrap.sectionsIndex?.sections)
    ? bootstrap.sectionsIndex.sections
    : [];
  const homeProducts = [
    ...(Array.isArray(bootstrap.home?.featuredProducts)
      ? bootstrap.home.featuredProducts
      : []),
    ...(Array.isArray(bootstrap.home?.latestProducts) ? bootstrap.home.latestProducts : []),
  ];
  const homeRoute = firstProductRoute(sections, homeProducts);
  if (homeRoute) return homeRoute;

  if (bootstrap.pointer?.schemaVersion !== 2 || !bootstrap.pointer.sections) return null;

  for (const section of sections) {
    if (!section?.id) continue;
    const reference = bootstrap.pointer.sections[section.id];
    if (!reference?.contentVersion) continue;
    const sectionResponse = await request.get(
      `/public/modules/sections/${encodeURIComponent(section.id)}/${encodeURIComponent(reference.contentVersion)}/section.json`,
      { headers: { 'cache-control': 'no-cache' } },
    );
    if (!sectionResponse.ok()) continue;
    const sectionPayload = (await sectionResponse.json()) as SectionPayload;
    const products = Array.isArray(sectionPayload.products) ? sectionPayload.products : [];
    const sectionRoute = firstProductRoute([section], products);
    if (sectionRoute) return sectionRoute;
  }

  return null;
}
