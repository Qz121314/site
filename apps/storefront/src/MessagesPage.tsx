import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useState } from 'react';
import type { StorefrontBootstrap } from './content';
import { loadProductSnapshot } from './content-route';
import { resolveCustomerServiceCta } from './cta';
import { MessagesArticleListWorkspace } from './MessagesArticleListWorkspace';
import { getMessageArticlesFromBootstrap } from './messages-articles';
import { installSupportExpiryRuntime } from './support-expiry-runtime';
import { replaceStorefrontLocation } from './storefront-navigation-runtime';
import type {
  SupportConversationDetail,
  SupportConversationSummary,
} from './support-contract';
import {
  loadPublicSupportConnections,
  siteSupportGateway,
  SupportApiError,
} from './support-gateway';
import {
  enableSupportPush,
  readSupportPushState,
  syncSupportPushSubscription,
  type SupportPushState,
} from './support-push';
import { MessagesWorkspace, type PendingSupportConversation } from './support-ui';
import { useSupportChatCore } from './support-chat-core';
import './messages-ui.css';
import './messages-media.css';

const HANDOFF_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type ComposeContext = {
  productId: string;
  sectionId: string;
  handoffId: string | null;
  ctaPath: string | null;
};
type ResolvedComposeContext = {
  productId: string;
  sectionId: string;
  handoffId: string;
};

function readComposeContext(): ComposeContext | null {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('productId')?.trim() ?? '';
  const sectionId = params.get('sectionId')?.trim() ?? '';
  const rawHandoffId = params.get('handoffId')?.trim() ?? '';
  const rawCtaPath = params.get('ctaPath')?.trim() ?? '';
  const handoffId = HANDOFF_ID_PATTERN.test(rawHandoffId) ? rawHandoffId : null;
  const ctaPath =
    rawCtaPath.startsWith('/go/') && rawCtaPath.length <= 240 ? rawCtaPath : null;
  if (
    !productId ||
    !sectionId ||
    (!handoffId && !ctaPath) ||
    productId.length > 120 ||
    sectionId.length > 120
  )
    return null;
  return { productId, sectionId, handoffId, ctaPath };
}

function parseResolvedComposePath(
  path: string,
  expected: Pick<ComposeContext, 'productId' | 'sectionId'>,
): ResolvedComposeContext {
  const target = new URL(path, window.location.origin);
  const productId = target.searchParams.get('productId')?.trim() ?? '';
  const sectionId = target.searchParams.get('sectionId')?.trim() ?? '';
  const handoffId = target.searchParams.get('handoffId')?.trim() ?? '';
  if (
    target.origin !== window.location.origin ||
    target.pathname !== '/messages/new/' ||
    productId !== expected.productId ||
    sectionId !== expected.sectionId ||
    !HANDOFF_ID_PATTERN.test(handoffId)
  ) {
    throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
  }
  return { productId, sectionId, handoffId };
}

function NotificationBellIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M18 8.8a6 6 0 0 0-12 0c0 6-2.4 6.4-2.4 7.8h16.8C20.4 15.2 18 14.8 18 8.8Z" />
      <path d="M9.7 19a2.6 2.6 0 0 0 4.6 0" />
      {enabled ? <path d="m16.5 4.2 1.4 1.4 2.7-3" /> : null}
    </svg>
  );
}

function conversationSummary(
  conversation: SupportConversationDetail,
): SupportConversationSummary {
  return {
    id: conversation.id,
    agentName: conversation.agentName,
    agentAvatarUrl: conversation.agentAvatarUrl,
    productTitle: conversation.productTitle,
    productCoverUrl: conversation.productCoverUrl,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: conversation.unreadCount,
    status: conversation.status,
  };
}

export function MessagesPage({
  activeConversationRef,
  bootstrap,
  compose,
  LinkComponent,
}: {
  activeConversationRef: string | null;
  bootstrap: StorefrontBootstrap;
  compose: boolean;
  LinkComponent: StorefrontLinkComponent;
}) {
  const queryClient = useQueryClient();
  useEffect(() => {
    installSupportExpiryRuntime();
  }, []);
  const [notificationState, setNotificationState] =
    useState<SupportPushState>('unsupported');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const supportConnectionsQuery = useQuery({
    queryKey: ['support-connections'],
    queryFn: ({ signal }) => loadPublicSupportConnections(signal),
    enabled: !compose,
    staleTime: 5_000,
    retry: 1,
  });
  const supportAvailable = supportConnectionsQuery.isSuccess
    ? supportConnectionsQuery.data.length > 0
    : null;
  const composeContext = compose ? readComposeContext() : null;
  const composeProductQuery = useQuery({
    queryKey: [
      'storefront-product',
      bootstrap.pointer.contentVersion,
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
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    retry: 1,
  });
  const composeHandoffQuery = useQuery({
    queryKey: ['support-compose-handoff', composeContext?.ctaPath],
    enabled: Boolean(composeContext?.ctaPath && !composeContext.handoffId),
    queryFn: async ({ signal }) => {
      if (!composeContext?.ctaPath) throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
      const path = await resolveCustomerServiceCta(composeContext.ctaPath, signal);
      return parseResolvedComposePath(path, composeContext);
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const resolvedComposeContext: ResolvedComposeContext | null = composeContext?.handoffId
    ? {
        productId: composeContext.productId,
        sectionId: composeContext.sectionId,
        handoffId: composeContext.handoffId,
      }
    : (composeHandoffQuery.data ?? null);

  const composeProduct = composeProductQuery.data?.product ?? null;
  const sortedProductMedia = composeProduct
    ? [...composeProduct.media].sort((left, right) => left.sortOrder - right.sortOrder)
    : [];
  const firstProductImageUrl =
    sortedProductMedia.find(
      (item) => item.url && !/\.(?:mp4|webm)(?:$|[?#])/iu.test(item.url),
    )?.url ??
    composeProduct?.coverUrl ??
    null;
  const pendingConversation: PendingSupportConversation | null = composeProduct
    ? {
        productTitle: composeProduct.title,
        productCoverUrl: firstProductImageUrl,
        productHref: `/sections/${encodeURIComponent(composeProduct.sectionId)}/products/${encodeURIComponent(composeProduct.id)}/`,
      }
    : null;
  const chatCore = useSupportChatCore({
    conversationRef: activeConversationRef,
    startInput:
      resolvedComposeContext && pendingConversation?.productHref
        ? {
            handoffId: resolvedComposeContext.handoffId,
            productId: resolvedComposeContext.productId,
            sectionId: resolvedComposeContext.sectionId,
            productTitle: pendingConversation.productTitle,
            productCoverUrl: pendingConversation.productCoverUrl,
            productHref: pendingConversation.productHref,
          }
        : null,
  });
  const activeConversation = chatCore.conversation;
  const conversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    enabled: supportAvailable === true && !compose,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const displayedConversation = activeConversation;
  const conversations = conversationsQuery.data ?? [];
  const messageArticles = getMessageArticlesFromBootstrap(bootstrap);
  const composeUnavailable =
    composeProductQuery.isError || composeHandoffQuery.isError || chatCore.error !== null;
  const composeConnecting = Boolean(
    compose &&
    composeContext &&
    (composeProductQuery.isLoading ||
      composeHandoffQuery.isFetching ||
      (!resolvedComposeContext && !composeHandoffQuery.isError) ||
      chatCore.loading),
  );
  const noAgentError =
    chatCore.error instanceof SupportApiError &&
    chatCore.error.code === 'NO_AGENT_AVAILABLE'
      ? chatCore.error
      : null;
  const noAgentNotice = noAgentError
    ? {
        message: noAgentError.message,
        format: noAgentError.format ?? ('plain' as const),
      }
    : null;
  const composeConnectionError = Boolean(
    compose && composeUnavailable && !composeConnecting && !noAgentNotice,
  );
  const conversationLoading = Boolean(activeConversationRef && chatCore.loading);
  const workspaceSupportAvailable = compose
    ? composeUnavailable
      ? false
      : chatCore.conversation
        ? true
        : null
    : supportAvailable;

  useEffect(() => {
    const resolved = composeHandoffQuery.data;
    if (!compose || !resolved || composeContext?.handoffId) return;
    const params = new URLSearchParams({
      productId: resolved.productId,
      sectionId: resolved.sectionId,
      handoffId: resolved.handoffId,
    });
    replaceStorefrontLocation(`/messages/new/?${params.toString()}`);
  }, [compose, composeContext?.handoffId, composeHandoffQuery.data]);

  useEffect(() => {
    let active = true;
    if (!activeConversationRef) {
      setNotificationState('unsupported');
      return () => {
        active = false;
      };
    }

    void readSupportPushState()
      .then(async (state) => {
        if (state !== 'enabled') return state;
        try {
          return await syncSupportPushSubscription(activeConversationRef);
        } catch {
          return state;
        }
      })
      .then((state) => {
        if (active) setNotificationState(state);
      })
      .catch(() => {
        if (active) setNotificationState('unsupported');
      });

    return () => {
      active = false;
    };
  }, [activeConversationRef]);

  useEffect(() => {
    const conversation = chatCore.conversation;
    if (!compose || !conversation) return;

    queryClient.setQueryData<SupportConversationSummary[]>(
      ['support-conversations'],
      (current) => {
        const summary = conversationSummary(conversation);
        const withoutCurrent = (current ?? []).filter((item) => item.id !== summary.id);
        return [summary, ...withoutCurrent];
      },
    );
    queryClient.setQueryData(['support-conversation', conversation.id], conversation);
    replaceStorefrontLocation(`/messages/${encodeURIComponent(conversation.id)}/`);
  }, [compose, chatCore.conversation, queryClient]);

  const showNotificationToggle =
    Boolean(activeConversationRef) && notificationState !== 'unsupported';
  const notificationLabel =
    notificationState === 'enabled'
      ? 'Notifications enabled'
      : notificationState === 'blocked'
        ? 'Notifications blocked'
        : 'Enable notifications';
  const workspaceConversationRef = compose ? '__new__' : activeConversationRef;
  const showMessageArticles = !compose && activeConversationRef === null;

  function retryComposeConnection() {
    if (composeProductQuery.isError) void composeProductQuery.refetch();
    if (composeHandoffQuery.isError) {
      void composeHandoffQuery.refetch();
      return;
    }
    chatCore.retryConnection();
  }

  return (
    <div
      className={`messages-push-host${showNotificationToggle ? ' has-push-toggle' : ''}`}
    >
      {showNotificationToggle ? (
        <button
          type="button"
          className={`messages-push-toggle${notificationState === 'enabled' ? ' is-enabled' : ''}`}
          aria-label={notificationLabel}
          title={notificationLabel}
          disabled={notificationBusy || notificationState !== 'prompt'}
          onClick={() => {
            if (!activeConversationRef || notificationState !== 'prompt') return;
            setNotificationBusy(true);
            void enableSupportPush(activeConversationRef)
              .then(setNotificationState)
              .catch(async () => {
                setNotificationState(await readSupportPushState());
              })
              .finally(() => setNotificationBusy(false));
          }}
        >
          <NotificationBellIcon enabled={notificationState === 'enabled'} />
        </button>
      ) : null}
      {showMessageArticles ? (
        <MessagesArticleListWorkspace
          articles={messageArticles}
          conversations={conversations}
          LinkComponent={LinkComponent}
          supportAvailable={workspaceSupportAvailable}
        />
      ) : (
        <MessagesWorkspace
          activeConversation={displayedConversation}
          activeConversationRef={workspaceConversationRef}
          conversations={conversations}
          pendingConversation={pendingConversation}
          supportAvailable={workspaceSupportAvailable}
          LinkComponent={LinkComponent}
          onSendMessage={
            supportAvailable && activeConversationRef ? chatCore.send : undefined
          }
          onRetryMessage={
            supportAvailable && activeConversationRef ? chatCore.retryMessage : undefined
          }
          sending={chatCore.sending}
          sendError={
            chatCore.sendError instanceof Error ? chatCore.sendError.message : null
          }
          onSendImage={
            supportAvailable && activeConversationRef ? chatCore.sendImage : undefined
          }
          onRetryImage={
            supportAvailable && activeConversationRef && chatCore.imageFailed
              ? chatCore.retryImage
              : undefined
          }
          imageSending={chatCore.imageSending}
          imageFailed={chatCore.imageFailed}
          imageProgress={chatCore.imageProgress}
          imagePreviewUrl={chatCore.imagePreviewUrl}
          imageError={
            chatCore.imageError instanceof Error ? chatCore.imageError.message : null
          }
          onLoadEarlier={
            activeConversation?.nextMessageCursor ? chatCore.loadEarlier : undefined
          }
          loadingEarlier={chatCore.loadingEarlier}
          loadingConversation={conversationLoading || composeConnecting}
          connectionError={composeConnectionError}
          noAgentNotice={noAgentNotice}
          onRetryConnection={
            compose && composeUnavailable ? retryComposeConnection : undefined
          }
          agentTyping={chatCore.agentTyping}
          onTypingChange={chatCore.setTyping}
        />
      )}
    </div>
  );
}
