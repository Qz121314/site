import { useQuery } from '@tanstack/react-query';
import {
  StorefrontBottomNavigation,
  StorefrontBrandBar,
  type StorefrontLinkComponent,
} from '@site/storefront-ui';
import {
  type AnchorHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  useSyncExternalStore,
} from 'react';
import { App } from './App';
import { loadStorefrontBootstrap, PublicContentError } from './content';
import { HomeFeed } from './HomeFeed';
import { ResilientImage } from './ResilientMedia';
import { bottomNavigationActiveHref } from './routing';
import {
  FALLBACK_STOREFRONT_COPY,
  loadStorefrontCopy,
  StorefrontCopyProvider,
} from './storefront-copy';
import { primaryNavigationItems } from './storefront-navigation';

const NAVIGATION_EVENT = 'storefront:navigate';

function subscribePathname(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATION_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATION_EVENT, callback);
  };
}

function currentPathname() {
  return window.location.pathname;
}

function StorefrontLink({ href = '/', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
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
    window.history.pushState(null, '', href);
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
  };

  return <a {...props} href={href} onClick={handleClick} />;
}

function HomeLoading() {
  return (
    <div className="app-shell loading-shell" aria-busy="true">
      <header className="topbar"><div className="loading-brand" /></header>
      <main>
        <div className="loading-grid">
          {Array.from({ length: 6 }, (_, index) => <div className="loading-card" key={index} />)}
        </div>
      </main>
    </div>
  );
}

function HomeError({ error }: { error: unknown }) {
  const message = error instanceof PublicContentError
    ? error.message
    : 'The storefront is temporarily unavailable.';
  return (
    <div className="standalone-state">
      <div className="state-mark">!</div>
      <h1>Storefront unavailable</h1>
      <p>{message}</p>
      <button type="button" onClick={() => window.location.reload()}>Try again</button>
    </div>
  );
}

function HomeRoot() {
  const bootstrapQuery = useQuery({
    queryKey: ['storefront-bootstrap'],
    queryFn: ({ signal }) => loadStorefrontBootstrap(undefined, signal),
    staleTime: 30_000,
  });
  const copyQuery = useQuery({
    queryKey: ['storefront-copy'],
    queryFn: ({ signal }) => loadStorefrontCopy(signal),
    staleTime: 30_000,
  });

  if (bootstrapQuery.isLoading) return <HomeLoading />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <HomeError error={bootstrapQuery.error} />;

  const site = bootstrapQuery.data.site.site;
  const initial = Array.from(site.name.trim())[0]?.toLocaleUpperCase('en') ?? '•';
  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;

  return (
    <StorefrontCopyProvider value={copy}>
      <div className="app-shell home-app-shell">
        <StorefrontBrandBar
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
          locationLabel={site.locationLabel}
          logo={(
            <ResilientImage
              alt=""
              fallback={<span className="brand-lettermark">{initial}</span>}
              src={site.logoUrl}
            />
          )}
          siteName={site.name}
        />
        <main><HomeFeed bootstrap={bootstrapQuery.data} /></main>
        <footer className="site-footer">{site.name}</footer>
        <StorefrontBottomNavigation
          activeHref={bottomNavigationActiveHref('/')}
          items={primaryNavigationItems(copy.navigation, 0)}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      </div>
    </StorefrontCopyProvider>
  );
}

export function StorefrontRoot() {
  const pathname = useSyncExternalStore(subscribePathname, currentPathname, () => '/');
  return pathname === '/' ? <HomeRoot /> : <App />;
}
