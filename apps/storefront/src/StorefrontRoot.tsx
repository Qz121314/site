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
import { FaqArticlePage, FaqDirectoryPage } from './FaqPage';
import { HomeFeed } from './HomeFeed';
import { ProductDetailPage } from './ProductDetailPage';
import { ResilientImage } from './ResilientMedia';
import { bottomNavigationActiveHref } from './routing';
import { SectionCatalogPage } from './SectionPage';
import {
  FALLBACK_STOREFRONT_COPY,
  loadStorefrontCopy,
  StorefrontCopyProvider,
} from './storefront-copy';
import { primaryNavigationItems } from './storefront-navigation';
import { MessagesWorkspace, type SupportConversationDetail } from './support-ui';

const NAVIGATION_EVENT = 'storefront:navigate';
const supportConversations: SupportConversationDetail[] = [];

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
  unreadMessages = 0,
}: {
  activePath: string;
  bootstrap: Awaited<ReturnType<typeof loadStorefrontBootstrap>>;
  copy: typeof FALLBACK_STOREFRONT_COPY;
  children: ReactNode;
  unreadMessages?: number;
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
          items={primaryNavigationItems(copy.navigation, unreadMessages)}
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

function messageConversationRef(pathname: string): string | null {
  const match = pathname.match(/^\/messages\/([^/]+)\/?$/u);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function MessagesRoot({ pathname }: { pathname: string }) {
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
  const activeConversationRef = messageConversationRef(pathname);
  const activeConversation = activeConversationRef
    ? supportConversations.find((conversation) => conversation.id === activeConversationRef) ?? null
    : null;
  const unreadMessages = supportConversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  if (bootstrapQuery.isLoading) return <PrimaryLoading />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <PrimaryError error={bootstrapQuery.error} />;

  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;
  return (
    <PrimaryShell
      activePath="/messages/"
      bootstrap={bootstrapQuery.data}
      copy={copy}
      unreadMessages={unreadMessages}
    >
      <MessagesWorkspace
        activeConversation={activeConversation}
        activeConversationRef={activeConversationRef}
        conversations={supportConversations}
        LinkComponent={StorefrontLink as StorefrontLinkComponent}
      />
    </PrimaryShell>
  );
}

function faqArticleRef(pathname: string): string | null {
  const match = pathname.match(/^\/faq\/([^/]+)\/?$/u);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function FaqRoot({ pathname }: { pathname: string }) {
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
  const articleRef = faqArticleRef(pathname);

  if (bootstrapQuery.isLoading) return <PrimaryLoading />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <PrimaryError error={bootstrapQuery.error} />;

  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;
  return (
    <PrimaryShell activePath="/faq/" bootstrap={bootstrapQuery.data} copy={copy}>
      {articleRef ? (
        <FaqArticlePage
          articleRef={articleRef}
          bootstrap={bootstrapQuery.data}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      ) : (
        <FaqDirectoryPage
          bootstrap={bootstrapQuery.data}
          LinkComponent={StorefrontLink as StorefrontLinkComponent}
        />
      )}
    </PrimaryShell>
  );
}

function sectionCatalogRef(pathname: string): string | null {
  const match = pathname.match(/^\/sections\/([^/]+)\/?$/u);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function SectionRoot({ pathname }: { pathname: string }) {
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
  const sectionRef = sectionCatalogRef(pathname);

  if (bootstrapQuery.isLoading) return <PrimaryLoading />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <PrimaryError error={bootstrapQuery.error} />;
  if (!sectionRef) return <App />;

  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;
  return (
    <PrimaryShell activePath="/browse/" bootstrap={bootstrapQuery.data} copy={copy}>
      <SectionCatalogPage
        bootstrap={bootstrapQuery.data}
        sectionRef={sectionRef}
        LinkComponent={StorefrontLink as StorefrontLinkComponent}
      />
    </PrimaryShell>
  );
}

type ProductRoute = {
  productRef: string;
  sectionRef: string | null;
};

function productRoute(pathname: string): ProductRoute | null {
  const nested = pathname.match(/^\/sections\/([^/]+)\/products\/([^/]+)\/?$/u);
  const legacy = pathname.match(/^\/products\/([^/]+)\/?$/u);
  try {
    if (nested?.[1] && nested[2]) {
      return {
        sectionRef: decodeURIComponent(nested[1]),
        productRef: decodeURIComponent(nested[2]),
      };
    }
    if (legacy?.[1]) {
      return { sectionRef: null, productRef: decodeURIComponent(legacy[1]) };
    }
  } catch {
    return null;
  }
  return null;
}

function ProductRoot({ pathname }: { pathname: string }) {
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
  const route = productRoute(pathname);

  if (bootstrapQuery.isLoading) return <PrimaryLoading />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <PrimaryError error={bootstrapQuery.error} />;
  if (!route) return <App />;

  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;
  return (
    <PrimaryShell activePath="/browse/" bootstrap={bootstrapQuery.data} copy={copy}>
      <ProductDetailPage
        bootstrap={bootstrapQuery.data}
        productRef={route.productRef}
        sectionRef={route.sectionRef}
        LinkComponent={StorefrontLink as StorefrontLinkComponent}
      />
    </PrimaryShell>
  );
}

function isBrowsePath(pathname: string): boolean {
  return pathname === '/browse' || pathname === '/browse/' || pathname === '/discover' || pathname === '/discover/';
}

function isMessagesPath(pathname: string): boolean {
  return pathname === '/messages' || pathname === '/messages/' || /^\/messages\/[^/]+\/?$/u.test(pathname);
}

function isFaqPath(pathname: string): boolean {
  return pathname === '/faq' || pathname === '/faq/' || /^\/faq\/[^/]+\/?$/u.test(pathname);
}

function isSectionPath(pathname: string): boolean {
  return /^\/sections\/[^/]+\/?$/u.test(pathname);
}

function isProductPath(pathname: string): boolean {
  return /^\/sections\/[^/]+\/products\/[^/]+\/?$/u.test(pathname)
    || /^\/products\/[^/]+\/?$/u.test(pathname);
}

export function StorefrontRoot() {
  const pathname = useSyncExternalStore(subscribePathname, currentPathname, () => '/');
  return (
    <>
      <StorefrontMetadata />
      {pathname === '/' ? (
        <HomeRoot />
      ) : isBrowsePath(pathname) ? (
        <BrowseRoot />
      ) : isMessagesPath(pathname) ? (
        <MessagesRoot pathname={pathname} />
      ) : isFaqPath(pathname) ? (
        <FaqRoot pathname={pathname} />
      ) : isSectionPath(pathname) ? (
        <SectionRoot pathname={pathname} />
      ) : isProductPath(pathname) ? (
        <ProductRoot pathname={pathname} />
      ) : (
        <App />
      )}
    </>
  );
}
