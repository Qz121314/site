import type { PublicProductSummary, PublicSection } from './content';

export type StorefrontRoute =
  | { type: 'home' }
  | { type: 'section'; sectionRef: string }
  | { type: 'product'; productRef: string; sectionRef: string | null }
  | { type: 'not-found' };

function decodeRoutePart(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded && decoded.length <= 120 ? decoded : null;
  } catch {
    return null;
  }
}

function routePart(value: string): string {
  return encodeURIComponent(value);
}

export function sectionHref(section: Pick<PublicSection, 'id' | 'slug'>): string {
  return `/sections/${routePart(section.slug || section.id)}/`;
}

export function productHref(
  product: Pick<PublicProductSummary, 'id' | 'slug' | 'sectionId' | 'sectionSlug'>,
): string {
  const sectionRef = product.sectionSlug || product.sectionId;
  const productRef = product.slug || product.id;
  return `/sections/${routePart(sectionRef)}/products/${routePart(productRef)}/`;
}

export function parseStorefrontRoute(pathname: string): StorefrontRoute {
  if (pathname === '/' || pathname === '') return { type: 'home' };

  const nestedProductMatch = /^\/sections\/([^/]+)\/products\/([^/]+)\/?$/.exec(pathname);
  if (nestedProductMatch) {
    const sectionRef = decodeRoutePart(nestedProductMatch[1] ?? '');
    const productRef = decodeRoutePart(nestedProductMatch[2] ?? '');
    return sectionRef && productRef
      ? { type: 'product', sectionRef, productRef }
      : { type: 'not-found' };
  }

  const sectionMatch = /^\/sections\/([^/]+)\/?$/.exec(pathname);
  if (sectionMatch) {
    const sectionRef = decodeRoutePart(sectionMatch[1] ?? '');
    return sectionRef ? { type: 'section', sectionRef } : { type: 'not-found' };
  }

  const legacyProductMatch = /^\/products\/([^/]+)\/?$/.exec(pathname);
  if (legacyProductMatch) {
    const productRef = decodeRoutePart(legacyProductMatch[1] ?? '');
    return productRef
      ? { type: 'product', sectionRef: null, productRef }
      : { type: 'not-found' };
  }

  return { type: 'not-found' };
}
