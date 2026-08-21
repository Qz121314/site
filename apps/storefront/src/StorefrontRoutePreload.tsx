import { useEffect } from 'react';
import { parseStorefrontRoute, type StorefrontRoute } from './routing';

type PreloadRouteType = Extract<
  StorefrontRoute['type'],
  'discover' | 'faq' | 'messages' | 'section' | 'product'
>;

const routeLoaders: Record<PreloadRouteType, () => Promise<unknown>> = {
  discover: () => import('./BrowsePage'),
  faq: () => import('./FaqPage'),
  messages: () => import('./MessagesPage'),
  section: () => import('./SectionPage'),
  product: () => import('./ProductDetailPage'),
};

const preloadedRoutes = new Set<PreloadRouteType>();

function preloadTypeForPathname(pathname: string): PreloadRouteType | null {
  const route = parseStorefrontRoute(pathname);
  switch (route.type) {
    case 'discover':
      return 'discover';
    case 'faq':
    case 'faq-article':
      return 'faq';
    case 'messages':
    case 'message-compose':
    case 'message':
      return 'messages';
    case 'section':
      return 'section';
    case 'product':
      return 'product';
    default:
      return null;
  }
}

export function preloadStorefrontRoute(href: string): void {
  if (!href.startsWith('/') || href.startsWith('/go/')) return;
  const pathname = href.split(/[?#]/u, 1)[0] || '/';
  const preloadType = preloadTypeForPathname(pathname);
  if (!preloadType || preloadedRoutes.has(preloadType)) return;

  preloadedRoutes.add(preloadType);
  void routeLoaders[preloadType]().catch(() => {
    preloadedRoutes.delete(preloadType);
  });
}

function internalAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
}

export function StorefrontRoutePreload() {
  useEffect(() => {
    const handleNavigationIntent = (event: Event) => {
      const anchor = internalAnchor(event.target);
      if (!anchor) return;
      preloadStorefrontRoute(anchor.getAttribute('href') ?? '');
    };

    document.addEventListener('pointerover', handleNavigationIntent, true);
    document.addEventListener('pointerdown', handleNavigationIntent, true);
    document.addEventListener('focusin', handleNavigationIntent, true);

    return () => {
      document.removeEventListener('pointerover', handleNavigationIntent, true);
      document.removeEventListener('pointerdown', handleNavigationIntent, true);
      document.removeEventListener('focusin', handleNavigationIntent, true);
    };
  }, []);

  return null;
}
