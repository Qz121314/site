import type { PublicProductSummary, PublicSection } from './content';

export type StorefrontRoute =
  | { type: 'home' }
  | { type: 'discover' }
  | { type: 'messages' }
  | { type: 'message-compose' }
  | { type: 'message'; conversationRef: string }
  | { type: 'faq' }
  | { type: 'faq-article'; articleRef: string }
  | { type: 'article'; articleId: string }
  | { type: 'section'; sectionRef: string }
  | { type: 'product'; productRef: string; sectionRef: string | null }
  | { type: 'landing'; slug: string }
  | { type: 'landing-chat'; slug: string; conversationRef: string | null }
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

export function sectionRefHref(sectionRef: string): string {
  return `/sections/${routePart(sectionRef)}/`;
}

export function sectionHref(section: Pick<PublicSection, 'id' | 'slug'>): string {
  return sectionRefHref(section.slug || section.id);
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

export function articleHref(articleId: string): string {
  return `/articles/${routePart(articleId)}/`;
}

export function bottomNavigationActiveHref(pathname: string): BottomNavigationHref {
  if (
    pathname === '/messages' ||
    pathname.startsWith('/messages/') ||
    pathname.startsWith('/articles/')
  )
    return '/messages/';
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

  const landingChatMatch = /^\/l\/([^/]+)\/chat\/?$/.exec(pathname);
  if (landingChatMatch) {
    const slug = decodeRoutePart(landingChatMatch[1] ?? '');
    return slug
      ? { type: 'landing-chat', slug, conversationRef: null }
      : { type: 'not-found' };
  }
  const landingConversationMatch = /^\/l\/([^/]+)\/chat\/([^/]+)\/?$/.exec(pathname);
  if (landingConversationMatch) {
    const slug = decodeRoutePart(landingConversationMatch[1] ?? '');
    const conversationRef = decodeRoutePart(landingConversationMatch[2] ?? '');
    return slug && conversationRef
      ? { type: 'landing-chat', slug, conversationRef }
      : { type: 'not-found' };
  }
  const landingMatch = /^\/l\/([^/]+)\/?$/.exec(pathname);
  if (landingMatch) {
    const slug = decodeRoutePart(landingMatch[1] ?? '');
    return slug ? { type: 'landing', slug } : { type: 'not-found' };
  }

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

  const articleMatch = /^\/articles\/([^/]+)\/?$/.exec(pathname);
  if (articleMatch) {
    const articleId = decodeRoutePart(articleMatch[1] ?? '');
    return articleId ? { type: 'article', articleId } : { type: 'not-found' };
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
