import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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
  useMemo,
  useSyncExternalStore,
} from 'react';
import { BrowsePage } from './BrowsePage';
import { loadStorefrontBootstrap, loadProductSnapshot, PublicContentError } from './content';
import { FaqArticlePage, FaqDirectoryPage } from './FaqPage';
import { HomeFeed } from './HomeFeed';
import { NotFoundPage } from './NotFoundPage';
import { ProductDetailPage } from './ProductDetailPage';
import { ResilientImage } from './ResilientMedia';
import { bottomNavigationActiveHref, parseStorefrontRoute } from './routing';
import { SectionCatalogPage } from './SectionPage';
import {
  FALLBACK_STOREFRONT_COPY,
  loadStorefrontCopy,
  StorefrontCopyProvider,
} from './storefront-copy';
import { primaryNavigationItems } from './storefront-navigation';
import { siteSupportGateway } from './support-gateway';
import { subscribeSupportRealtime } from './support-realtime';
import type { SupportConversationDetail } from './support-contract';
import { MessagesWorkspace, type PendingSupportConversation } from './support-ui';

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
      <header className="topbar">
        <div className="loading-brand" />
      </header>
      <main>
        <div className="loading-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="loading-card" key={index} />
          ))}
        </div>
      </main>
    </div>
  );
}

function PrimaryError({ error }: { error: unknown }) {
  const message =
    error instanceof PublicContentError
      ? error.message
      : 'The storefront is temporarily unavailable.';
  return (
    <div className="standalone-state">
      <div className="state-mark">!</div>
      <h1>Storefront unavailable</h1>
      <p>{message}</p>
      <button type="button" onClick={() => window.location.reload()}>
        Try again
      </button>
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
          logo={
            site.logoUrl ? (
              <ResilientImage alt="" fallback={null} src={site.logoUrl} />
            ) : null
          }
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
  if (bootstrapQuery.error || !bootstrapQuery.data)
    return <PrimaryError error={bootstrapQuery.error} />;

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
  if (bootstrapQuery.error || !bootstrapQuery.data)
    return <PrimaryError error={bootstrapQuery.error} />;

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

type ComposeContext = { productId: string; sectionId: string };

function readComposeContext(): ComposeContext | null {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('productId')?.trim() ?? '';
  const sectionId = params.get('sectionId')?.trim() ?? '';
  if (!productId || !sectionId || productId.length > 120 || sectionId.length > 120) return null;
  return { productId, sectionId };
}

function combineConversationPages(
  pages: Array<SupportConversationDetail | null> | undefined,
): SupportConversationDetail | null {
  const validPages = pages?.filter((page): page is SupportConversationDetail => Boolean(page)) ?? [];
  const latest = validPages[0];
  if (!latest) return null;
  const messages = [...validPages].reverse().flatMap((page) => page.messages);
  const oldestLoaded = validPages[validPages.length - 1];
  return {
    ...latest,
    messages,
    nextMessageCursor: oldestLoaded?.nextMessageCursor ?? null,
  };
}

function MessagesRoot({
  activeConversationRef,
  compose,
}: {
  activeConversationRef: string | null;
  compose: boolean;
}) {
  const queryClient = useQueryClient();
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
  const conversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    staleTime: 5_000,
    retry: 1,
  });
  const conversationQuery = useInfiniteQuery({
    queryKey: ['support-conversation', activeConversationRef],
    enabled: Boolean(activeConversationRef),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      if (!activeConversationRef) return Promise.resolve(null);
      return siteSupportGateway.getConversation(activeConversationRef, pageParam, signal);
    },
    getNextPageParam: (page) => page?.nextMessageCursor ?? undefined,
    retry: 1,
  });
  const composeContext = compose ? readComposeContext() : null;
  const composeProductQuery = useQuery({
    queryKey: ['support-compose-product', composeContext?.sectionId, composeContext?.productId],
    enabled: Boolean(composeContext && bootstrapQuery.data),
    queryFn: ({ signal }) => {
      if (!composeContext || !bootstrapQuery.data) throw new Error('INVALID_COMPOSE_CONTEXT');
      return loadProductSnapshot(
        bootstrapQuery.data,
        composeContext.productId,
        signal,
        composeContext.sectionId,
      );
    },
    staleTime: 30_000,
    retry: 1,
  });

  const activeConversation = useMemo(
    () => combineConversationPages(conversationQuery.data?.pages),
    [conversationQuery.data?.pages],
  );
  const pendingConversation: PendingSupportConversation | null = composeProductQuery.data?.product
    ? {
        productTitle: composeProductQuery.data.product.title,
        productCoverUrl: composeProductQuery.data.product.coverUrl,
        productHref: `/sections/${encodeURIComponent(composeProductQuery.data.product.sectionId)}/products/${encodeURIComponent(composeProductQuery.data.product.id)}/`,
      }
    : null;
  const conversations = conversationsQuery.data ?? [];
  const unreadMessages = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );
  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;

  useEffect(() => subscribeSupportRealtime((event) => {
    void queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
    if (event.conversationRef) {
      void queryClient.invalidateQueries({
        queryKey: ['support-conversation', event.conversationRef],
      });
    }
  }), [queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      if (activeConversationRef) {
        await siteSupportGateway.sendMessage(activeConversationRef, {
          clientMessageId: crypto.randomUUID(),
          body,
        });
        return { kind: 'message' as const };
      }
      if (composeContext && pendingConversation && pendingConversation.productHref) {
        const conversation = await siteSupportGateway.startConversation({
          productId: composeContext.productId,
          sectionId: composeContext.sectionId,
          productTitle: pendingConversation.productTitle,
          productCoverUrl: pendingConversation.productCoverUrl,
          productHref: pendingConversation.productHref,
          clientMessageId: crypto.randomUUID(),
          message: body,
        });
        return { kind: 'conversation' as const, conversation };
      }
      throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
      if (result.kind === 'conversation') {
        navigateStorefront(`/messages/${encodeURIComponent(result.conversation.id)}/`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['support-conversation', activeConversationRef] });
    },
  });

  useEffect(() => {
    if (!activeConversationRef || !activeConversation || activeConversation.unreadCount <= 0) return;
    const lastAgentMessage = [...activeConversation.messages]
      .reverse()
      .find((message) => message.direction === 'agent')?.id ?? null;
    void siteSupportGateway
      .markConversationRead(activeConversationRef, lastAgentMessage)
      .then(() => queryClient.invalidateQueries({ queryKey: ['support-conversations'] }))
      .catch(() => undefined);
  }, [activeConversationRef, activeConversation, queryClient]);

  if (bootstrapQuery.isLoading) return <PrimaryLoading />;
  if (bootstrapQuery.error || !bootstrapQuery.data)
    return <PrimaryError error={bootstrapQuery.error} />;

  const workspaceConversationRef = compose ? '__new__' : activeConversationRef;
  const sendError = sendMutation.error ? copy.messages.sendFailed : null;
  return (
    <PrimaryShell
      activePath="/messages/"
      bootstrap={bootstrapQuery.data}
      copy={copy}
      unreadMessages={unreadMessages}
    >
      <MessagesWorkspace
        activeConversation={activeConversation}
        activeConversationRef={workspaceConversationRef}
        conversations={conversations}
        pendingConversation={pendingConversation}
        LinkComponent={StorefrontLink as StorefrontLinkComponent}
        onSendMessage={async (body) => {
          await sendMutation.mutateAsync(body);
        }}
        sending={sendMutation.isPending}
        sendError={sendError}
        onLoadEarlier={activeConversation?.nextMessageCursor ? async () => {
          await conversationQuery.fetchNextPage();
        } : undefined}
        loadingEarlier={conversationQuery.isFetchingNextPage}
        loadingConversation={
          Boolean(activeConversationRef && conversationQuery.isLoading)
          || Boolean(compose && composeContext && composeProductQuery.isLoading)
        }
      />
    </PrimaryShell>
  );
}

function FaqRoot({ articleRef }: { articleRef: string | null }) {
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
  if (bootstrapQuery.error || !bootstrapQuery.data)
    return <PrimaryError error={bootstrapQuery.error} />;

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

function SectionRoot({ sectionRef }: { sectionRef: string }) {
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
  if (bootstrapQuery.error || !bootstrapQuery.data)
    return <PrimaryError error={bootstrapQuery.error} />;

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

function ProductRoot({
  productRef,
  sectionRef,
}: {
  productRef: string;
  sectionRef: string | null;
}) {
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
  if (bootstrapQuery.error || !bootstrapQuery.data)
    return <PrimaryError error={bootstrapQuery.error} />;

  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;
  return (
    <PrimaryShell activePath="/browse/" bootstrap={bootstrapQuery.data} copy={copy}>
      <ProductDetailPage
        bootstrap={bootstrapQuery.data}
        productRef={productRef}
        sectionRef={sectionRef}
        LinkComponent={StorefrontLink as StorefrontLinkComponent}
      />
    </PrimaryShell>
  );
}

function NotFoundRoot({ pathname }: { pathname: string }) {
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
  if (bootstrapQuery.error || !bootstrapQuery.data)
    return <PrimaryError error={bootstrapQuery.error} />;

  const copy = copyQuery.data ?? FALLBACK_STOREFRONT_COPY;
  return (
    <PrimaryShell activePath={pathname} bootstrap={bootstrapQuery.data} copy={copy}>
      <NotFoundPage
        siteName={bootstrapQuery.data.site.site.name}
        LinkComponent={StorefrontLink as StorefrontLinkComponent}
      />
    </PrimaryShell>
  );
}

export function StorefrontRoot() {
  const pathname = useSyncExternalStore(subscribePathname, currentPathname, () => '/');
  const route = parseStorefrontRoute(pathname);
  let page: ReactNode;

  switch (route.type) {
    case 'home':
      page = <HomeRoot />;
      break;
    case 'discover':
      page = <BrowseRoot />;
      break;
    case 'messages':
      page = <MessagesRoot activeConversationRef={null} compose={false} />;
      break;
    case 'message-compose':
      page = <MessagesRoot activeConversationRef={null} compose />;
      break;
    case 'message':
      page = <MessagesRoot activeConversationRef={route.conversationRef} compose={false} />;
      break;
    case 'faq':
      page = <FaqRoot articleRef={null} />;
      break;
    case 'faq-article':
      page = <FaqRoot articleRef={route.articleRef} />;
      break;
    case 'section':
      page = <SectionRoot sectionRef={route.sectionRef} />;
      break;
    case 'product':
      page = <ProductRoot productRef={route.productRef} sectionRef={route.sectionRef} />;
      break;
    default:
      page = <NotFoundRoot pathname={pathname} />;
  }

  return (
    <>
      <StorefrontMetadata />
      {page}
    </>
  );
}
