import { useQuery } from '@tanstack/react-query';
import {
  StorefrontBottomNavigation,
  StorefrontBrandBar,
  StorefrontBrandName,
  type StorefrontLinkComponent,
} from '@site/storefront-ui';
import { ChevronLeft, CircleAlert, MapPin } from 'lucide-react';
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
import { peekSupportVisitorIdentity } from './support-identity';
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
const StorefrontSupportRuntime = lazy(() =>
  import('./StorefrontSupportRuntime').then((module) => ({
    default: module.StorefrontSupportRuntime,
  })),
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
        <ChevronLeft aria-hidden="true" />
      </StorefrontLink>
      <StorefrontLink className="brand-lockup" href="/" aria-label={site.name}>
        <span className="brand-logo">
          {site.logoUrl ? (
            <ResilientImage alt="" fallback={null} src={site.logoUrl} />
          ) : null}
        </span>
        <span>
          <StorefrontBrandName siteName={site.name} />
          <small className="brand-location">
            <MapPin aria-hidden="true" />
            <span>{site.locationLabel}</span>
          </small>
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

function PrimaryError() {
  return (
    <div className="standalone-state">
      <div className="state-mark" aria-hidden="true">
        <CircleAlert />
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const bootstrapQuery = useQuery({
    queryKey: ['storefront-bootstrap'],
    queryFn: ({ signal }) => loadStorefrontBootstrap(undefined, signal),
    staleTime: 30_000,
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

  useEffect(() => {
    if (!supportRuntimeEnabled) setUnreadMessages(0);
  }, [supportRuntimeEnabled]);

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
      {supportRuntimeEnabled ? (
        <Suspense fallback={null}>
          <StorefrontSupportRuntime
            conversationListEnabled={route.type !== 'message-compose'}
            onUnreadMessages={setUnreadMessages}
          />
        </Suspense>
      ) : null}
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
