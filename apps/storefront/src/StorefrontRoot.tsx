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
  useEffect,
  useSyncExternalStore,
} from 'react';
import { App } from './App';
import { BrowsePage } from './BrowsePage';
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

function StorefrontMetadata() {
  const bootstrapQuery = useQuery({
    queryKey: ['storefront-bootstrap'],
    queryFn: ({ signal }) => loadStorefrontBootstrap(undefined, signal),
    staleTime: 30_000,
  });
  const description = bootstrapQuery.data?.site.site.locationLabel.trim() ?? '';

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

function PrimaryLoading() {
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

function PrimaryError({ error }: { error: unknown }) {
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

function PrimaryShell({
  activePath,
  bootstrap,
  copy,
  children,
}: {
  activePath: string;
  bootstrap: Awaited<ReturnType<typeof loadStorefrontBootstrap>>;
  copy: typeof FALLBACK_STOREFRONT_COPY;
  children: ReactNode;
}) {
  const site = bootstrap.site.site;
  return (
    <StorefrontCopyProvider value={copy}>
      <div className="app-shell">
        <StorefrontBrandBar
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
          locationLabel={site.locationLabel}
          logo={site.logoUrl ? <ResilientImage alt="" fallback={null} src={site.logoUrl} /> : null}
          siteName={site.name}
        />
        <main>{children}</main>
        <footer className="site-footer">{site.name}</footer>
        <StorefrontBottomNavigation
          activeHref={bottomNavigationActiveHref(activePath)}
          items={primaryNavigationItems(copy.navigation, 0)}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      </div>
    </StorefrontCopyProvider>
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

  if (bootstrapQuery.isLoading) return <PrimaryLoading />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <PrimaryError error={bootstrapQuery.error} />;

  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;
  return (
    <PrimaryShell activePath="/" bootstrap={bootstrapQuery.data} copy={copy}>
      <HomeFeed bootstrap={bootstrapQuery.data} />
    </PrimaryShell>
  );
}

function BrowseRoot() {
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

  if (bootstrapQuery.isLoading) return <PrimaryLoading />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <PrimaryError error={bootstrapQuery.error} />;

  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;
  return (
    <PrimaryShell activePath="/browse/" bootstrap={bootstrapQuery.data} copy={copy}>
      <BrowsePage
        bootstrap={bootstrapQuery.data}
        LinkComponent={StorefrontLink as StorefrontLinkComponent}
      />
    </PrimaryShell>
  );
}

function isBrowsePath(pathname: string): boolean {
  return pathname === '/browse' || pathname === '/browse/' || pathname === '/discover' || pathname === '/discover/';
}

export function StorefrontRoot() {
  const pathname = useSyncExternalStore(subscribePathname, currentPathname, () => '/');
  return (
    <>
      <StorefrontMetadata />
      {pathname === '/' ? <HomeRoot /> : isBrowsePath(pathname) ? <BrowseRoot /> : <App />}
    </>
  );
}
