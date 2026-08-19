import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useMemo, useState } from 'react';
import { loadProductSnapshot, type StorefrontBootstrap } from './content';
import type {
  SupportConversationDetail,
  SupportConversationSummary,
  SupportMessage,
} from './support-contract';
import { loadPublicSupportConnections, siteSupportGateway } from './support-gateway';
import { prepareSupportImage, releaseSupportImage } from './support-image-compress';
import {
  enableSupportPush,
  readSupportPushState,
  syncSupportPushSubscription,
  type SupportPushState,
} from './support-push';
import { MessagesWorkspace, type PendingSupportConversation } from './support-ui';
import './messages-ui.css';
import './messages-media.css';

const NAVIGATION_EVENT = 'storefront:navigate';

type ComposeContext = { productId: string; sectionId: string; handoffId: string };
type ConversationQueryCache = {
  pages: Array<SupportConversationDetail | null>;
  pageParams: Array<string | null>;
};
type SendMessageVariables = {
  body: string;
  clientMessageId: string;
  sentAt: string;
  conversationRef: string | null;
};
type ImageMutationVariables = {
  file: File;
  previewUrl: string;
  conversationRef: string;
};

function readComposeContext(): ComposeContext | null {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('productId')?.trim() ?? '';
  const sectionId = params.get('sectionId')?.trim() ?? '';
  const handoffId = params.get('handoffId')?.trim() ?? '';
  if (
    !productId ||
    !sectionId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      handoffId,
    ) ||
    productId.length > 120 ||
    sectionId.length > 120
  )
    return null;
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

function combineConversationPages(
  pages: Array<SupportConversationDetail | null> | undefined,
): SupportConversationDetail | null {
  const validPages =
    pages?.filter((page): page is SupportConversationDetail => Boolean(page)) ?? [];
  const latest = validPages[0];
  if (!latest) return null;

  const seen = new Set<string>();
  const messages: SupportMessage[] = [];
  for (const page of [...validPages].reverse()) {
    for (const message of page.messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      messages.push(message);
    }
  }

  const oldestLoaded = validPages[validPages.length - 1];
  return {
    ...latest,
    messages,
    nextMessageCursor: oldestLoaded?.nextMessageCursor ?? null,
  };
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

function updateConversationCache(
  queryClient: QueryClient,
  conversationRef: string,
  update: (conversation: SupportConversationDetail) => SupportConversationDetail,
) {
  queryClient.setQueryData<ConversationQueryCache>(
    ['support-conversation', conversationRef],
    (current) => {
      if (!current?.pages[0]) return current;
      return {
        ...current,
        pages: current.pages.map((page, index) =>
          index === 0 && page ? update(page) : page,
        ),
      };
    },
  );
}

function upsertOptimisticMessage(
  queryClient: QueryClient,
  conversationRef: string,
  message: SupportMessage,
) {
  updateConversationCache(queryClient, conversationRef, (conversation) => {
    const exists = conversation.messages.some((item) => item.id === message.id);
    return {
      ...conversation,
      lastMessage: message.body,
      lastMessageAt: message.sentAt,
      messages: exists
        ? conversation.messages.map((item) => (item.id === message.id ? message : item))
        : [...conversation.messages, message],
    };
  });
}

function replaceOptimisticMessage(
  queryClient: QueryClient,
  conversationRef: string,
  optimisticId: string,
  message: SupportMessage,
) {
  updateConversationCache(queryClient, conversationRef, (conversation) => ({
    ...conversation,
    lastMessage: message.body,
    lastMessageAt: message.sentAt,
    messages: conversation.messages.map((item) =>
      item.id === optimisticId ? message : item,
    ),
  }));
}

function updateOptimisticDelivery(
  queryClient: QueryClient,
  conversationRef: string,
  optimisticId: string,
  delivery: SupportMessage['delivery'],
) {
  updateConversationCache(queryClient, conversationRef, (conversation) => ({
    ...conversation,
    messages: conversation.messages.map((item) =>
      item.id === optimisticId ? { ...item, delivery } : item,
    ),
  }));
}

function updateConversationPreview(
  queryClient: QueryClient,
  conversationRef: string,
  body: string,
  sentAt: string,
) {
  queryClient.setQueryData<SupportConversationSummary[]>(
    ['support-conversations'],
    (current) =>
      current?.map((conversation) =>
        conversation.id === conversationRef
          ? {
              ...conversation,
              lastMessage: body,
              lastMessageAt: sentAt,
            }
          : conversation,
      ) ?? current,
  );
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
  const [imageProgress, setImageProgress] = useState<number | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
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
  const conversationQuery = useInfiniteQuery({
    queryKey: ['support-conversation', activeConversationRef],
    enabled: Boolean(activeConversationRef),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      if (!activeConversationRef) return Promise.resolve(null);
      return siteSupportGateway.getConversation(activeConversationRef, pageParam, signal);
    },
    getNextPageParam: (page) => page?.nextMessageCursor ?? undefined,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
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
  const composeStartQuery = useQuery({
    queryKey: ['support-compose-start', composeContext?.handoffId],
    enabled: Boolean(composeContext && pendingConversation?.productHref),
    queryFn: ({ signal }) => {
      if (!composeContext || !pendingConversation?.productHref)
        throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
      return siteSupportGateway.startConversation(
        {
          handoffId: composeContext.handoffId,
          productId: composeContext.productId,
          sectionId: composeContext.sectionId,
          productTitle: pendingConversation.productTitle,
          productCoverUrl: pendingConversation.productCoverUrl,
          productHref: pendingConversation.productHref,
        },
        signal,
      );
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
  });
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
  const workspaceSupportAvailable = compose
    ? composeStartQuery.isError
      ? false
      : composeStartQuery.data
        ? true
        : null
    : supportAvailable;

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
    const conversation = composeStartQuery.data;
    if (!compose || !conversation) return;

    queryClient.setQueryData<SupportConversationSummary[]>(
      ['support-conversations'],
      (current) => {
        const summary = conversationSummary(conversation);
        const withoutCurrent = (current ?? []).filter((item) => item.id !== summary.id);
        return [summary, ...withoutCurrent];
      },
    );
    queryClient.setQueryData<ConversationQueryCache>(
      ['support-conversation', conversation.id],
      { pages: [conversation], pageParams: [null] },
    );
    window.history.replaceState(
      null,
      '',
      `/messages/${encodeURIComponent(conversation.id)}/`,
    );
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
  }, [compose, composeStartQuery.data, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (variables: SendMessageVariables) => {
      if (!variables.conversationRef) throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
      return siteSupportGateway.sendMessage(variables.conversationRef, {
        clientMessageId: variables.clientMessageId,
        body: variables.body,
      });
    },
    onMutate: (variables) => {
      const optimisticId = `local:${variables.clientMessageId}`;
      const optimisticMessage: SupportMessage = {
        id: optimisticId,
        direction: 'customer',
        body: variables.body,
        sentAt: variables.sentAt,
        delivery: 'sending',
        attachments: [],
      };
      if (variables.conversationRef) {
        upsertOptimisticMessage(
          queryClient,
          variables.conversationRef,
          optimisticMessage,
        );
        updateConversationPreview(
          queryClient,
          variables.conversationRef,
          variables.body,
          variables.sentAt,
        );
      }
      return { optimisticId };
    },
    onSuccess: (message, variables, context) => {
      if (!variables.conversationRef) return;
      replaceOptimisticMessage(
        queryClient,
        variables.conversationRef,
        context.optimisticId,
        message,
      );
      updateConversationPreview(
        queryClient,
        variables.conversationRef,
        message.body,
        message.sentAt,
      );
    },
    onError: (_error, variables, context) => {
      if (!variables.conversationRef) return;
      const optimisticId = context?.optimisticId ?? `local:${variables.clientMessageId}`;
      updateOptimisticDelivery(
        queryClient,
        variables.conversationRef,
        optimisticId,
        'failed',
      );
    },
  });

  const imageMutation = useMutation({
    mutationFn: async ({ file, conversationRef }: ImageMutationVariables) => {
      const image = await prepareSupportImage(file);
      try {
        return await siteSupportGateway.sendImage(
          conversationRef,
          {
            blob: image.blob,
            mimeType: image.mimeType,
            byteSize: image.byteSize,
            width: image.width,
            height: image.height,
            originalName: image.originalName,
          },
          setImageProgress,
        );
      } finally {
        releaseSupportImage(image);
      }
    },
    onSuccess: (message, variables) => {
      upsertOptimisticMessage(queryClient, variables.conversationRef, message);
      updateConversationPreview(
        queryClient,
        variables.conversationRef,
        message.body,
        message.sentAt,
      );
      setImagePreviewUrl((current) =>
        current === variables.previewUrl ? null : current,
      );
      setImageProgress(null);
      URL.revokeObjectURL(variables.previewUrl);
    },
    onError: () => {
      setImageProgress(null);
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
      .then(() => {
        queryClient.setQueryData<SupportConversationSummary[]>(
          ['support-conversations'],
          (current) =>
            current?.map((conversation) =>
              conversation.id === activeConversationRef
                ? { ...conversation, unreadCount: 0 }
                : conversation,
            ) ?? current,
        );
        updateConversationCache(queryClient, activeConversationRef, (conversation) => ({
          ...conversation,
          unreadCount: 0,
          messages: conversation.messages.map((message) =>
            message.direction === 'agent' && message.delivery === 'sent'
              ? { ...message, delivery: 'read' }
              : message,
          ),
        }));
      })
      .catch(() => undefined);
  }, [activeConversationRef, activeConversation, queryClient]);

  const showNotificationToggle =
    Boolean(activeConversationRef) && notificationState !== 'unsupported';
  const notificationLabel =
    notificationState === 'enabled'
      ? 'Notifications enabled'
      : notificationState === 'blocked'
        ? 'Notifications blocked'
        : 'Enable notifications';
  const workspaceConversationRef = compose ? '__new__' : activeConversationRef;

  async function retryMessage(message: SupportMessage) {
    const clientMessageId = message.id.startsWith('local:')
      ? message.id.slice('local:'.length)
      : crypto.randomUUID();
    await sendMutation.mutateAsync({
      body: message.body,
      clientMessageId,
      sentAt: message.sentAt,
      conversationRef: activeConversationRef,
    });
  }

  async function sendImage(file: File) {
    if (!activeConversationRef) return;
    if (imagePreviewUrl && imageMutation.isError) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setImageProgress(0);
    try {
      await imageMutation.mutateAsync({
        file,
        previewUrl,
        conversationRef: activeConversationRef,
      });
    } catch {
      // The preview remains visible with an inline retry state.
    }
  }

  async function retryImage() {
    const variables = imageMutation.variables;
    if (!variables || imageMutation.isPending) return;
    setImageProgress(0);
    try {
      await imageMutation.mutateAsync(variables);
    } catch {
      // The same preview remains available for another retry.
    }
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
      <MessagesWorkspace
        activeConversation={displayedConversation}
        activeConversationRef={workspaceConversationRef}
        conversations={conversations}
        pendingConversation={pendingConversation}
        supportAvailable={workspaceSupportAvailable}
        LinkComponent={LinkComponent}
        onSendMessage={
          supportAvailable && activeConversationRef
            ? async (body) => {
                await sendMutation.mutateAsync({
                  body,
                  clientMessageId: crypto.randomUUID(),
                  sentAt: new Date().toISOString(),
                  conversationRef: activeConversationRef,
                });
              }
            : undefined
        }
        onRetryMessage={
          supportAvailable && activeConversationRef ? retryMessage : undefined
        }
        sending={sendMutation.isPending}
        sendError={null}
        onSendImage={supportAvailable && activeConversationRef ? sendImage : undefined}
        onRetryImage={
          supportAvailable && activeConversationRef && imageMutation.isError
            ? retryImage
            : undefined
        }
        imageSending={imageMutation.isPending}
        imageFailed={imageMutation.isError && Boolean(imagePreviewUrl)}
        imageProgress={imageProgress}
        imagePreviewUrl={imagePreviewUrl}
        imageError={null}
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
          Boolean(
            compose &&
            composeContext &&
            (composeProductQuery.isLoading || composeStartQuery.isFetching),
          )
        }
      />
    </div>
  );
}
