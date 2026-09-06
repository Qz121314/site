import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { StorefrontBootstrap } from './content';
import { parseStorefrontRoute, type StorefrontRoute } from './routing';

type PreloadRouteType = Extract<
  StorefrontRoute['type'],
  'article' | 'discover' | 'faq' | 'messages' | 'section' | 'product'
>;

const routeLoaders: Record<PreloadRouteType, () => Promise<unknown>> = {
  article: () => import('./ArticlePage'),
  discover: () => import('./BrowsePage'),
  faq: () => import('./FaqPage'),
  messages: () => import('./MessagesPage'),
  section: () => import('./SectionPage'),
  product: () => import('./ProductDetailPage'),
};

const preloadedRoutes = new Set<PreloadRouteType>();

function preloadTypeForRoute(route: StorefrontRoute): PreloadRouteType | null {
  switch (route.type) {
    case 'article':
      return 'article';
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

function articleContentVersion(bootstrap: StorefrontBootstrap): string {
  return bootstrap.pointer.schemaVersion === 2
    ? bootstrap.pointer.faq.contentVersion
    : bootstrap.pointer.contentVersion;
}

function preloadArticleContent(
  route: Extract<StorefrontRoute, { type: 'article' }>,
  queryClient: QueryClient,
): void {
  const bootstrap = queryClient.getQueryData<StorefrontBootstrap>(['storefront-bootstrap']);
  if (!bootstrap) return;
  const contentVersion = articleContentVersion(bootstrap);
  void import('./content-route').then(({ loadArticleSnapshot }) =>
    queryClient.prefetchQuery({
      queryKey: ['storefront-article', contentVersion, route.articleId],
      queryFn: ({ signal }) => loadArticleSnapshot(bootstrap, route.articleId, signal),
      staleTime: Number.POSITIVE_INFINITY,
    }),
  );
}

function preloadStorefrontRoute(href: string, queryClient: QueryClient): void {
  if (!href.startsWith('/') || href.startsWith('/go/')) return;
  const pathname = href.split(/[?#]/u, 1)[0] || '/';
  const route = parseStorefrontRoute(pathname);
  const preloadType = preloadTypeForRoute(route);
  if (!preloadType) return;

  if (!preloadedRoutes.has(preloadType)) {
    preloadedRoutes.add(preloadType);
    void routeLoaders[preloadType]().catch(() => {
      preloadedRoutes.delete(preloadType);
    });
  }
  if (route.type === 'article') preloadArticleContent(route, queryClient);
}

function internalAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
}

export function StorefrontRoutePreload() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleNavigationIntent = (event: Event) => {
      const anchor = internalAnchor(event.target);
      if (!anchor) return;
      preloadStorefrontRoute(anchor.getAttribute('href') ?? '', queryClient);
    };

    document.addEventListener('pointerover', handleNavigationIntent, true);
    document.addEventListener('pointerdown', handleNavigationIntent, true);
    document.addEventListener('focusin', handleNavigationIntent, true);

    return () => {
      document.removeEventListener('pointerover', handleNavigationIntent, true);
      document.removeEventListener('pointerdown', handleNavigationIntent, true);
      document.removeEventListener('focusin', handleNavigationIntent, true);
    };
  }, [queryClient]);

  return null;
}
