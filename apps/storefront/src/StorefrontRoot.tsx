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
  useState,
  useSyncExternalStore,
} from 'react';
import { BrowsePage } from './BrowsePage';
import {
  loadBottomNavigation,
  type BottomNavigationItemConfig,
} from './bottom-navigation';
import { loadStorefrontBootstrap, loadProductSnapshot } from './content';
import { FaqArticlePage, FaqDirectoryPage } from './FaqPage';
import { HomeFeed } from './HomeFeed';
import { HomepageAnalytics } from './HomepageAnalytics';
import { NotFoundPage } from './NotFoundPage';
import { ProductDetailPage } from './ProductDetailPage';
import { ResilientImage } from './ResilientMedia';
import { bottomNavigationActiveHref, parseStorefrontRoute } from './routing';
import { SectionCatalogPage } from './SectionPage';
import { primaryNavigationItems } from './storefront-navigation';
import { siteSupportGateway } from './support-gateway';
import { subscribeSupportRealtime } from './support-realtime';
import type { SupportConversationDetail } from './support-contract';
import { MessagesWorkspace, type PendingSupportConversation } from './support-ui';
import { SYSTEM_UI } from './system-ui';

const NAVIGATION_EVENT = 'storefront:navigate';

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

type ComposeContext = { productId: string; sectionId: string };

function readComposeContext(): ComposeContext | null {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('productId')?.trim() ?? '';
  const sectionId = params.get('sectionId')?.trim() ?? '';
  if (!productId || !sectionId || productId.length > 120 || sectionId.length > 120)
    return null;
  return { productId, sectionId };
}

function combineConversationPages(
  pages: Array<SupportConversationDetail | null> | undefined,
): SupportConversationDetail | null {
  const validPages =
    pages?.filter((page): page is SupportConversationDetail => Boolean(page)) ?? [];
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

function MessagesPage({
  activeConversationRef,
  bootstrap,
  compose,
  onUnreadMessagesChange,
}: {
  activeConversationRef: string | null;
  bootstrap: Awaited<ReturnType<typeof loadStorefrontBootstrap>>;
  compose: boolean;
  onUnreadMessagesChange: (count: number) => void;
}) {
  const queryClient = useQueryClient();
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
    queryKey: [
      'support-compose-product',
      composeContext?.sectionId,
      composeContext?.productId,
    ],
    enabled: Boolean(composeContext),
    queryFn: ({ signal }) => {
      if (!composeContext) throw new Error('INVALID_COMPOSE_CONTEXT');
      return loadProductSnapshot(
        bootstrap,
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
  const pendingConversation: PendingSupportConversation | null = composeProductQuery.data
    ?.product
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

  useEffect(() => {
    onUnreadMessagesChange(unreadMessages);
  }, [onUnreadMessagesChange, unreadMessages]);

  useEffect(
    () =>
      subscribeSupportRealtime((event) => {
        void queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
        if (event.conversationRef) {
          void queryClient.invalidateQueries({
            queryKey: ['support-conversation', event.conversationRef],
          });
        }
      }),
    [queryClient],
  );

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
      await queryClient.invalidateQueries({
        queryKey: ['support-conversation', activeConversationRef],
      });
    },
  });

  useEffect(() => {
    if (
      !activeConversationRef ||
      !activeConversation ||
      activeConversation.unreadCount <= 0
    )
      return;
    const lastAgentMessage =
      [...activeConversation.messages]
        .reverse()
        .find((message) => message.direction === 'agent')?.id ?? null;
    void siteSupportGateway
      .markConversationRead(activeConversationRef, lastAgentMessage)
      .then(() => queryClient.invalidateQueries({ queryKey: ['support-conversations'] }))
      .catch(() => undefined);
  }, [activeConversationRef, activeConversation, queryClient]);

  const workspaceConversationRef = compose ? '__new__' : activeConversationRef;
  const sendError = sendMutation.error ? SYSTEM_UI.messageFailed : null;
  return (
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
      onLoadEarlier={
        activeConversation?.nextMessageCursor
          ? async () => {
              await conversationQuery.fetchNextPage();
            }
          : undefined
      }
      loadingEarlier={conversationQuery.isFetchingNextPage}
      loadingConversation={
        Boolean(activeConversationRef && conversationQuery.isLoading) ||
        Boolean(compose && composeContext && composeProductQuery.isLoading)
      }
    />
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

  if (bootstrapQuery.isLoading) return <PrimaryLoading />;
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
        {page}
      </PrimaryShell>
    </>
  );
}
