import { useQuery } from '@tanstack/react-query';
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
  useState,
  useSyncExternalStore,
} from 'react';
import {
  loadBottomNavigation,
  type BottomNavigationItemConfig,
} from './bottom-navigation';
import { loadStorefrontBootstrap } from './content';
import { HomeFeed } from './HomeFeed';
import { HomepageAnalytics } from './HomepageAnalytics';
import { RouteProgress, StartupLoader } from './LoadingStates';
import { NotFoundPage } from './NotFoundPage';
import { ResilientImage } from './ResilientMedia';
import { bottomNavigationActiveHref, parseStorefrontRoute } from './routing';
import { primaryNavigationItems } from './storefront-navigation';
import { SYSTEM_UI } from './system-ui';

const NAVIGATION_EVENT = 'storefront:navigate';

const BrowsePage = lazy(() =>
  import('./BrowsePage').then((module) => ({ default: module.BrowsePage })),
);
const FaqDirectoryPage = lazy(() =>
  import('./FaqPage').then((module) => ({ default: module.FaqDirectoryPage })),
);
const FaqArticlePage = lazy(() =>
  import('./FaqPage').then((module) => ({ default: module.FaqArticlePage })),
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
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATION_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATION_EVENT, callback);
  };
}

function currentLocationKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function pathnameFromLocationKey(locationKey: string) {
  const queryIndex = locationKey.indexOf('?');
  return queryIndex === -1 ? locationKey : locationKey.slice(0, queryIndex);
}

function navigateStorefront(href: string) {
  window.history.pushState(null, '', href);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

function StorefrontLink({
  href = '/',
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !href.startsWith('/') ||
      href.startsWith('/go/')
    ) {
      return;
    }
    event.preventDefault();
    navigateStorefront(href);
  };

  return <a {...props} href={href} onClick={handleClick} />;
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
      <div className="state-mark">!</div>
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
  routeKey,
  unreadMessages = 0,
}: {
  activePath: string;
  bootstrap: Awaited<ReturnType<typeof loadStorefrontBootstrap>>;
  navigationItems: BottomNavigationItemConfig[];
  children: ReactNode;
  routeKey: string;
  unreadMessages?: number;
}) {
  const site = bootstrap.site.site;
  return (
    <div className="app-shell">
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
      <main>
        <div className="storefront-route-view" key={routeKey}>
          {children}
        </div>
      </main>
      <footer className="site-footer">{site.name}</footer>
      {navigationItems.length > 0 ? (
        <StorefrontBottomNavigation
          activeHref={bottomNavigationActiveHref(activePath)}
          items={primaryNavigationItems(navigationItems, unreadMessages)}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      ) : null}
    </div>
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const bootstrapQuery = useQuery({
    queryKey: ['storefront-bootstrap'],
    queryFn: ({ signal }) => loadStorefrontBootstrap(undefined, signal),
    staleTime: 30_000,
  });
  const navigationQuery = useQuery({
    queryKey: ['bottom-navigation'],
    queryFn: ({ signal }) => loadBottomNavigation(signal),
    staleTime: 30_000,
  });

  if (bootstrapQuery.isLoading) return <StartupLoader />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <PrimaryError />;

  const bootstrap = bootstrapQuery.data;
  const navigationItems = navigationQuery.data ?? [];
  let page: ReactNode;

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
          onUnreadMessagesChange={setUnreadMessages}
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
          onUnreadMessagesChange={setUnreadMessages}
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
          onUnreadMessagesChange={setUnreadMessages}
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
      page = (
        <ProductDetailPage
          bootstrap={bootstrap}
          productRef={route.productRef}
          sectionRef={route.sectionRef}
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
        routeKey={locationKey}
        unreadMessages={unreadMessages}
      >
        <Suspense fallback={<RouteProgress />}>{page}</Suspense>
      </PrimaryShell>
    </>
  );
}
