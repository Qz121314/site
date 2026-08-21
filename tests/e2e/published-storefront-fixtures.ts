import type { APIRequestContext } from '@playwright/test';

type PublishedSectionRoute = {
  sectionHref: string;
};

type PublishedProductRoute = PublishedSectionRoute & {
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

function sectionRoute(sectionId: string): PublishedSectionRoute {
  return { sectionHref: `/sections/${encodeURIComponent(sectionId)}/` };
}

function productRoute(sectionId: string, productId: string): PublishedProductRoute {
  return {
    ...sectionRoute(sectionId),
    productHref: `/sections/${encodeURIComponent(sectionId)}/products/${encodeURIComponent(productId)}/`,
  };
}

function validSections(bootstrap: BootstrapPayload): PublishedSection[] {
  return Array.isArray(bootstrap.sectionsIndex?.sections)
    ? bootstrap.sectionsIndex.sections.filter(
        (section) => typeof section?.id === 'string' && section.id.length > 0,
      )
    : [];
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
  return product ? productRoute(product.sectionId, product.id) : null;
}

async function loadBootstrap(request: APIRequestContext): Promise<BootstrapPayload> {
  const response = await request.get('/api/public/storefront/bootstrap', {
    headers: { 'cache-control': 'no-cache' },
  });
  if (!response.ok()) {
    throw new Error(
      `Storefront bootstrap is unavailable during production acceptance (${response.status()}).`,
    );
  }
  return (await response.json()) as BootstrapPayload;
}

export async function findPublishedSectionRoute(
  request: APIRequestContext,
): Promise<PublishedSectionRoute | null> {
  const sections = validSections(await loadBootstrap(request));
  const section = sections[0];
  return section ? sectionRoute(section.id) : null;
}

export async function findPublishedProductRoute(
  request: APIRequestContext,
): Promise<PublishedProductRoute | null> {
  const bootstrap = await loadBootstrap(request);
  const sections = validSections(bootstrap);
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
    const reference = bootstrap.pointer.sections[section.id];
    if (!reference?.contentVersion) continue;
    const response = await request.get(
      `/public/modules/sections/${encodeURIComponent(section.id)}/${encodeURIComponent(reference.contentVersion)}/section.json`,
      { headers: { 'cache-control': 'no-cache' } },
    );
    if (!response.ok()) continue;
    const sectionPayload = (await response.json()) as SectionPayload;
    const products = Array.isArray(sectionPayload.products) ? sectionPayload.products : [];
    const route = firstProductRoute([section], products);
    if (route) return route;
  }

  return null;
}
