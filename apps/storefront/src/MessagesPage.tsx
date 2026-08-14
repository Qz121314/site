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
import { SYSTEM_UI } from './system-ui';
import './messages-ui.css';
import './messages-media.css';

const NAVIGATION_EVENT = 'storefront:navigate';

type ComposeContext = { productId: string; sectionId: string };
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
};

function readComposeContext(): ComposeContext | null {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('productId')?.trim() ?? '';
  const sectionId = params.get('sectionId')?.trim() ?? '';
  if (!productId || !sectionId || productId.length > 120 || sectionId.length > 120)
    return null;
  return { productId, sectionId };
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

function appendOptimisticMessage(
  queryClient: QueryClient,
  conversationRef: string,
  message: SupportMessage,
) {
  updateConversationCache(queryClient, conversationRef, (conversation) => ({
    ...conversation,
    lastMessage: message.body,
    lastMessageAt: message.sentAt,
    messages: [...conversation.messages, message],
  }));
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

function removeOptimisticMessage(
  queryClient: QueryClient,
  conversationRef: string,
  optimisticId: string,
) {
  updateConversationCache(queryClient, conversationRef, (conversation) => ({
    ...conversation,
    messages: conversation.messages.filter((item) => item.id !== optimisticId),
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
  const [composeOptimisticMessage, setComposeOptimisticMessage] =
    useState<SupportMessage | null>(null);
  const [imageProgress, setImageProgress] = useState<number | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [notificationState, setNotificationState] =
    useState<SupportPushState>('unsupported');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const supportConnectionsQuery = useQuery({
    queryKey: ['support-connections'],
    queryFn: ({ signal }) => loadPublicSupportConnections(signal),
    staleTime: 5_000,
    retry: 1,
  });
  const supportAvailable = supportConnectionsQuery.isSuccess
    ? supportConnectionsQuery.data.length > 0
    : null;
  const conversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    enabled: supportAvailable === true,
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
  const optimisticComposeConversation = useMemo<SupportConversationDetail | null>(() => {
    if (!composeOptimisticMessage || !pendingConversation) return null;
    return {
      id: '__new__',
      agentName: null,
      agentAvatarUrl: null,
      productTitle: pendingConversation.productTitle,
      productCoverUrl: pendingConversation.productCoverUrl,
      productHref: pendingConversation.productHref,
      lastMessage: composeOptimisticMessage.body,
      lastMessageAt: composeOptimisticMessage.sentAt,
      unreadCount: 0,
      status: 'waiting',
      createdAt: composeOptimisticMessage.sentAt,
      expiresAt: composeOptimisticMessage.sentAt,
      messages: [composeOptimisticMessage],
      nextMessageCursor: null,
    };
  }, [composeOptimisticMessage, pendingConversation]);
  const displayedConversation = activeConversation ?? optimisticComposeConversation;
  const conversations = conversationsQuery.data ?? [];

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

  const sendMutation = useMutation({
    mutationFn: async (variables: SendMessageVariables) => {
      if (variables.conversationRef) {
        const message = await siteSupportGateway.sendMessage(variables.conversationRef, {
          clientMessageId: variables.clientMessageId,
          body: variables.body,
        });
        return { kind: 'message' as const, message };
      }
      if (composeContext && pendingConversation?.productHref) {
        const conversation = await siteSupportGateway.startConversation({
          productId: composeContext.productId,
          sectionId: composeContext.sectionId,
          productTitle: pendingConversation.productTitle,
          productCoverUrl: pendingConversation.productCoverUrl,
          productHref: pendingConversation.productHref,
          clientMessageId: variables.clientMessageId,
          message: variables.body,
        });
        return { kind: 'conversation' as const, conversation };
      }
      throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
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
        appendOptimisticMessage(
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
      } else {
        setComposeOptimisticMessage(optimisticMessage);
      }
      return { optimisticId };
    },
    onSuccess: (result, variables, context) => {
      if (result.kind === 'conversation') {
        setComposeOptimisticMessage(null);
        window.history.pushState(
          null,
          '',
          `/messages/${encodeURIComponent(result.conversation.id)}/`,
        );
        window.dispatchEvent(new Event(NAVIGATION_EVENT));
        return;
      }
      if (variables.conversationRef) {
        replaceOptimisticMessage(
          queryClient,
          variables.conversationRef,
          context.optimisticId,
          result.message,
        );
      }
    },
    onError: (_error, variables, context) => {
      if (variables.conversationRef) {
        removeOptimisticMessage(
          queryClient,
          variables.conversationRef,
          context?.optimisticId ?? `local:${variables.clientMessageId}`,
        );
      } else {
        setComposeOptimisticMessage(null);
      }
    },
    onSettled: (_result, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
      if (variables.conversationRef) {
        void queryClient.invalidateQueries({
          queryKey: ['support-conversation', variables.conversationRef],
        });
      }
    },
  });

  const imageMutation = useMutation({
    mutationFn: async ({ file }: ImageMutationVariables) => {
      if (!activeConversationRef) throw new Error('IMAGE_CONTEXT_UNAVAILABLE');
      const image = await prepareSupportImage(file);
      try {
        await siteSupportGateway.sendImage(
          activeConversationRef,
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
    onSuccess: (_result, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['support-conversations'] }),
        queryClient.invalidateQueries({
          queryKey: ['support-conversation', activeConversationRef],
        }),
      ]).finally(() => {
        setImagePreviewUrl((current) => (current === variables.previewUrl ? null : current));
        setImageProgress(null);
        URL.revokeObjectURL(variables.previewUrl);
      });
    },
    onError: (_error, variables) => {
      setImagePreviewUrl((current) => (current === variables.previewUrl ? null : current));
      setImageProgress(null);
      URL.revokeObjectURL(variables.previewUrl);
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
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['support-conversations'] }),
          queryClient.invalidateQueries({
            queryKey: ['support-conversation', activeConversationRef],
          }),
        ]);
      })
      .catch(() => undefined);
  }, [activeConversationRef, activeConversation, queryClient]);

  const showNotificationToggle =
    Boolean(activeConversationRef) && notificationState !== 'unsupported';
  const notificationLabel =
    notificationState === 'enabled'
      ? SYSTEM_UI.notificationsEnabled
      : notificationState === 'blocked'
        ? SYSTEM_UI.notificationsBlocked
        : SYSTEM_UI.enableNotifications;
  const workspaceConversationRef = compose ? '__new__' : activeConversationRef;

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
        supportAvailable={supportAvailable}
        LinkComponent={LinkComponent}
        onSendMessage={
          supportAvailable
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
        sending={compose && sendMutation.isPending}
        sendError={sendMutation.error ? SYSTEM_UI.messageFailed : null}
        onSendImage={
          supportAvailable && activeConversationRef
            ? async (file) => {
                const previewUrl = URL.createObjectURL(file);
                setImagePreviewUrl(previewUrl);
                setImageProgress(0);
                try {
                  await imageMutation.mutateAsync({ file, previewUrl });
                } catch {
                  // Mutation state renders the error; do not surface an unhandled promise.
                }
              }
            : undefined
        }
        imageSending={imageMutation.isPending}
        imageProgress={imageProgress}
        imagePreviewUrl={imagePreviewUrl}
        imageError={imageMutation.error ? SYSTEM_UI.messageFailed : null}
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
    </div>
  );
}
