import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  StorefrontBottomNavigation,
  StorefrontBrandBar,
  type StorefrontLinkComponent,
} from '@site/storefront-ui';
import {
  type AnchorHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { BottomNavigationItemConfig } from './bottom-navigation';
import { loadStorefrontBootstrap } from './content';
import { HomeFeed } from './HomeFeed';
import { HomepageAnalytics } from './HomepageAnalytics';
import { RouteProgress, StartupLoader } from './LoadingStates';
import { NotFoundPage } from './NotFoundPage';
import { ProductDetailLoadingSurface } from './ProductDetailLoadingSurface';
import { ResilientImage } from './ResilientMedia';
import {
  bottomNavigationActiveHref,
  parseStorefrontRoute,
  sectionRefHref,
  type StorefrontRoute,
} from './routing';
import { publishPwaInstallRuntime } from './pwa-install-runtime';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';
import { STOREFRONT_LOCATION_EVENT } from './storefront-location-runtime';
import { primaryNavigationItems } from './storefront-navigation';
import { handleStorefrontLinkClick } from './storefront-navigation-runtime';
import { StorefrontRouteActionHostProvider } from './StorefrontRouteAction';
import { observeStorefrontShellChrome } from './storefront-viewport-runtime';
import type { SupportConversationSummary } from './support-contract';
import { siteSupportGateway } from './support-gateway';
import { peekSupportVisitorIdentity } from './support-identity';
import { syncSupportAppBadge } from './support-push';
import { subscribeSupportRealtime } from './support-realtime';
import {
  applyRealtimeToConversationCache,
  applyRealtimeToConversationList,
  type SupportConversationQueryCache,
} from './support-realtime-cache';
import { SYSTEM_UI } from './system-ui';
import { applyStorefrontTheme } from './theme-runtime';

type ShellHeaderMode = 'brand' | 'detail' | 'hidden-mobile';

const BrowsePage = lazy(() =>
  import('./BrowsePage').then((module) => ({ default: module.BrowsePage })),
);
const FaqDirectoryPage = lazy(() =>
  import('./FaqPage').then((module) => ({ default: module.FaqDirectoryPage })),
);
const FaqArticlePage = lazy(() =>
  import('./FaqPage').then((module) => ({ default: module.FaqArticlePage })),
);
const LegacyProductRoute = lazy(() =>
  import('./LegacyProductRoute').then((module) => ({
    default: module.LegacyProductRoute,
  })),
);
const ProductDetailPage = lazy(() =>
  import('./ProductDetailPage').then((module) => ({
    default: module.ProductDetailPage,
  })),
);
const SectionCatalogPage = lazy(() =>
  import('./SectionPage').then((module) => ({ default: module.SectionCatalogPage })),
);
const MessagesPage = lazy(() =>
  import('./MessagesPage').then((module) => ({ default: module.MessagesPage })),
);

function subscribeLocation(callback: () => void) {
  window.addEventListener(STOREFRONT_LOCATION_EVENT, callback);
  return () => window.removeEventListener(STOREFRONT_LOCATION_EVENT, callback);
}

function currentLocationKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function pathnameFromLocationKey(locationKey: string) {
  const queryIndex = locationKey.indexOf('?');
  return queryIndex === -1 ? locationKey : locationKey.slice(0, queryIndex);
}

function StorefrontLink({
  href = '/',
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    handleStorefrontLinkClick(event, href);
  };

  return <a {...props} href={href} onClick={handleClick} />;
}

function handleShellBack(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (!canNavigateStorefrontBack()) return;
  event.preventDefault();
  navigateStorefrontBack();
}

function shellHeaderMode(route: StorefrontRoute): ShellHeaderMode {
  if (route.type === 'product') return 'detail';
  switch (route.type) {
    case 'section':
    case 'faq-article':
    case 'message':
    case 'message-compose':
      return 'hidden-mobile';
    default:
      return 'brand';
  }
}

function ProductShellHeader({
  bootstrap,
  route,
}: {
  bootstrap: Awaited<ReturnType<typeof loadStorefrontBootstrap>>;
  route: Extract<StorefrontRoute, { type: 'product' }>;
}) {
  const site = bootstrap.site.site;
  const backHref = route.sectionRef ? sectionRefHref(route.sectionRef) : '/browse/';

  return (
    <header className="topbar storefront-detail-topbar">
      <StorefrontLink
        aria-label={SYSTEM_UI.back}
        className="storefront-detail-back"
        href={backHref}
        onClick={handleShellBack}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="m12.5 4.5-5.5 5.5 5.5 5.5" />
        </svg>
      </StorefrontLink>
      <StorefrontLink className="brand-lockup" href="/" aria-label={site.name}>
        <span className="brand-logo">
          {site.logoUrl ? (
            <ResilientImage alt="" fallback={null} src={site.logoUrl} />
          ) : null}
        </span>
        <span>
          <strong>{site.name}</strong>
          <small>⌖ {site.locationLabel}</small>
        </span>
      </StorefrontLink>
      <span className="storefront-detail-header-spacer" aria-hidden="true" />
    </header>
  );
}

function StorefrontMetadata({ description }: { description: string }) {
  useEffect(() => {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      meta?.remove();
      return;
    }
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.append(meta);
    }
    meta.content = description;
  }, [description]);

  return null;
}

function UnavailableIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 4.75a7.25 7.25 0 1 1-7.25 7.25A7.25 7.25 0 0 1 12 4.75Z" />
      <path d="M12 8.25v4.5M12 15.75h.01" />
    </svg>
  );
}

function PrimaryError() {
  return (
    <div className="standalone-state">
      <div className="state-mark" aria-hidden="true">
        <UnavailableIcon />
      </div>
      <h1>{SYSTEM_UI.unavailable}</h1>
      <button type="button" onClick={() => window.location.reload()}>
        {SYSTEM_UI.retry}
      </button>
    </div>
  );
}

function PrimaryShell({
  activePath,
  bootstrap,
  navigationItems,
  children,
  route,
  routeKey,
  unreadMessages = 0,
}: {
  activePath: string;
  bootstrap: Awaited<ReturnType<typeof loadStorefrontBootstrap>>;
  navigationItems: BottomNavigationItemConfig[];
  children: ReactNode;
  route: StorefrontRoute;
  routeKey: string;
  unreadMessages?: number;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [routeActionHost, setRouteActionHost] = useState<HTMLDivElement | null>(null);
  const site = bootstrap.site.site;
  const headerMode = shellHeaderMode(route);
  const showBottomNavigation = route.type !== 'product';

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    return observeStorefrontShellChrome(shell);
  }, []);

  return (
    <StorefrontRouteActionHostProvider host={routeActionHost}>
      <div
        className="app-shell"
        data-shell-header={headerMode}
        data-shell-route={route.type}
        ref={shellRef}
      >
        {route.type === 'product' ? (
          <ProductShellHeader bootstrap={bootstrap} route={route} />
        ) : (
          <StorefrontBrandBar
            LinkComponent={StorefrontLink as StorefrontLinkComponent}
            locationLabel={site.locationLabel}
            logo={
              site.logoUrl ? (
                <ResilientImage alt="" fallback={null} src={site.logoUrl} />
              ) : null
            }
            siteName={site.name}
          />
        )}
        <main>
          <div className="storefront-route-view" key={routeKey}>
            {children}
          </div>
        </main>
        <div className="storefront-bottom-chrome">
          {showBottomNavigation ? (
            navigationItems.length > 0 ? (
              <StorefrontBottomNavigation
                activeHref={bottomNavigationActiveHref(activePath)}
                items={primaryNavigationItems(navigationItems, unreadMessages)}
                LinkComponent={StorefrontLink as StorefrontLinkComponent}
              />
            ) : null
          ) : (
            <div className="storefront-route-action-host" ref={setRouteActionHost} />
          )}
        </div>
      </div>
    </StorefrontRouteActionHostProvider>
  );
}

export function StorefrontRoot() {
  const queryClient = useQueryClient();
  const locationKey = useSyncExternalStore(
    subscribeLocation,
    currentLocationKey,
    () => '/',
  );
  const pathname = pathnameFromLocationKey(locationKey) || '/';
  const route = parseStorefrontRoute(pathname);
  const supportRuntimeEnabled =
    route.type === 'messages' ||
    route.type === 'message-compose' ||
    route.type === 'message' ||
    Boolean(peekSupportVisitorIdentity());
  const bootstrapQuery = useQuery({
    queryKey: ['storefront-bootstrap'],
    queryFn: ({ signal }) => loadStorefrontBootstrap(undefined, signal),
    staleTime: 30_000,
  });
  const supportConversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    enabled: supportRuntimeEnabled,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useLayoutEffect(() => {
    const bootstrap = bootstrapQuery.data;
    if (!bootstrap) return;
    applyStorefrontTheme(bootstrap.theme);
    publishPwaInstallRuntime({
      appName: bootstrap.site.site.name,
      config: bootstrap.theme.installPrompt,
    });
  }, [bootstrapQuery.data]);

  const unreadMessages = (supportConversationsQuery.data ?? []).reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  useEffect(() => {
    void syncSupportAppBadge(unreadMessages);
  }, [unreadMessages]);

  useEffect(() => {
    if (!supportRuntimeEnabled) return undefined;
    return subscribeSupportRealtime((event) => {
      if (event.type === 'realtime.recovered') {
        void queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
        void queryClient.invalidateQueries({ queryKey: ['support-conversation'] });
        return;
      }
      if (event.type === 'realtime.connected') return;
      queryClient.setQueryData<SupportConversationSummary[]>(
        ['support-conversations'],
        (current) => applyRealtimeToConversationList(current, event),
      );
      if (event.conversationRef) {
        queryClient.setQueryData<SupportConversationQueryCache>(
          ['support-conversation', event.conversationRef],
          (current) => applyRealtimeToConversationCache(current, event),
        );
      }
    });
  }, [queryClient, supportRuntimeEnabled]);

  if (bootstrapQuery.isLoading) return <StartupLoader />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <PrimaryError />;

  const bootstrap = bootstrapQuery.data;
  const navigationItems = bootstrap.bottomNavigation;
  let page: ReactNode;
  let routeFallback: ReactNode = <RouteProgress />;

  switch (route.type) {
    case 'home':
      page = <HomeFeed bootstrap={bootstrap} />;
      break;
    case 'discover':
      page = (
        <BrowsePage
          bootstrap={bootstrap}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
      break;
    case 'messages':
      page = (
        <MessagesPage
          activeConversationRef={null}
          bootstrap={bootstrap}
          compose={false}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
      break;
    case 'message-compose':
      page = (
        <MessagesPage
          activeConversationRef={null}
          bootstrap={bootstrap}
          compose
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
      break;
    case 'message':
      page = (
        <MessagesPage
          activeConversationRef={route.conversationRef}
          bootstrap={bootstrap}
          compose={false}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
      break;
    case 'faq':
      page = (
        <FaqDirectoryPage
          bootstrap={bootstrap}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
      break;
    case 'faq-article':
      page = (
        <FaqArticlePage
          articleRef={route.articleRef}
          bootstrap={bootstrap}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
      break;
    case 'section':
      page = (
        <SectionCatalogPage
          bootstrap={bootstrap}
          sectionRef={route.sectionRef}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
      break;
    case 'product':
      routeFallback = <ProductDetailLoadingSurface />;
      page = route.sectionRef ? (
        <ProductDetailPage
          bootstrap={bootstrap}
          productRef={route.productRef}
          sectionRef={route.sectionRef}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      ) : (
        <LegacyProductRoute
          bootstrap={bootstrap}
          productRef={route.productRef}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
      break;
    default:
      page = (
        <NotFoundPage
          siteName={bootstrap.site.site.name}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      );
  }

  return (
    <>
      <HomepageAnalytics
        measurementId={bootstrap.site.site.analytics.ga4MeasurementId}
        pathname={pathname}
      />
      <StorefrontMetadata description={bootstrap.site.site.locationLabel.trim()} />
      <PrimaryShell
        activePath={pathname}
        bootstrap={bootstrap}
        navigationItems={navigationItems}
        route={route}
        routeKey={pathname}
        unreadMessages={unreadMessages}
      >
        <Suspense fallback={routeFallback}>{page}</Suspense>
      </PrimaryShell>
    </>
  );
}
