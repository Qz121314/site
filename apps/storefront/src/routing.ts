import type { PublicProductSummary, PublicSection } from './content';

export type StorefrontRoute =
  | { type: 'home' }
  | { type: 'discover' }
  | { type: 'messages' }
  | { type: 'message-compose' }
  | { type: 'message'; conversationRef: string }
  | { type: 'faq' }
  | { type: 'faq-article'; articleRef: string }
  | { type: 'section'; sectionRef: string }
  | { type: 'product'; productRef: string; sectionRef: string | null }
  | { type: 'not-found' };

export type BottomNavigationHref = '/' | '/browse/' | '/messages/' | '/faq/';

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

export function faqArticleHref(articleRef: string): string {
  return `/faq/${routePart(articleRef)}/`;
}

export function bottomNavigationActiveHref(pathname: string): BottomNavigationHref {
  if (pathname === '/messages' || pathname.startsWith('/messages/')) return '/messages/';
  if (pathname === '/faq' || pathname.startsWith('/faq/')) return '/faq/';
  if (
    pathname === '/browse' ||
    pathname.startsWith('/browse/') ||
    pathname === '/discover' ||
    pathname.startsWith('/discover/') ||
    pathname.startsWith('/sections/') ||
    pathname.startsWith('/products/')
  ) {
    return '/browse/';
  }
  return '/';
}

export function parseStorefrontRoute(pathname: string): StorefrontRoute {
  if (pathname === '/' || pathname === '') return { type: 'home' };
  if (
    pathname === '/browse' ||
    pathname === '/browse/' ||
    pathname === '/discover' ||
    pathname === '/discover/'
  )
    return { type: 'discover' };
  if (pathname === '/messages' || pathname === '/messages/') return { type: 'messages' };
  if (pathname === '/messages/new' || pathname === '/messages/new/')
    return { type: 'message-compose' };
  if (pathname === '/faq' || pathname === '/faq/') return { type: 'faq' };

  const messageMatch = /^\/messages\/([^/]+)\/?$/.exec(pathname);
  if (messageMatch) {
    const conversationRef = decodeRoutePart(messageMatch[1] ?? '');
    return conversationRef ? { type: 'message', conversationRef } : { type: 'not-found' };
  }

  const faqArticleMatch = /^\/faq\/([^/]+)\/?$/.exec(pathname);
  if (faqArticleMatch) {
    const articleRef = decodeRoutePart(faqArticleMatch[1] ?? '');
    return articleRef ? { type: 'faq-article', articleRef } : { type: 'not-found' };
  }

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
