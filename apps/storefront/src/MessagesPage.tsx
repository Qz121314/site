import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useMemo } from 'react';
import { loadProductSnapshot, type StorefrontBootstrap } from './content';
import type { SupportConversationDetail, SupportMessage } from './support-contract';
import { loadPublicSupportConnections, siteSupportGateway } from './support-gateway';
import { subscribeSupportRealtime } from './support-realtime';
import { MessagesWorkspace, type PendingSupportConversation } from './support-ui';
import { SYSTEM_UI } from './system-ui';
import './messages-ui.css';

const NAVIGATION_EVENT = 'storefront:navigate';

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

export function MessagesPage({
  activeConversationRef,
  bootstrap,
  compose,
  LinkComponent,
  onUnreadMessagesChange,
}: {
  activeConversationRef: string | null;
  bootstrap: StorefrontBootstrap;
  compose: boolean;
  LinkComponent: StorefrontLinkComponent;
  onUnreadMessagesChange: (count: number) => void;
}) {
  const queryClient = useQueryClient();
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
        const conversationRef = event.conversationRef ?? activeConversationRef;
        if (conversationRef) {
          void queryClient.invalidateQueries({
            queryKey: ['support-conversation', conversationRef],
          });
        }
      }),
    [activeConversationRef, queryClient],
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
      if (composeContext && pendingConversation?.productHref) {
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
        window.history.pushState(
          null,
          '',
          `/messages/${encodeURIComponent(result.conversation.id)}/`,
        );
        window.dispatchEvent(new Event(NAVIGATION_EVENT));
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

  const workspaceConversationRef = compose ? '__new__' : activeConversationRef;
  return (
    <MessagesWorkspace
      activeConversation={activeConversation}
      activeConversationRef={workspaceConversationRef}
      conversations={conversations}
      pendingConversation={pendingConversation}
      supportAvailable={supportAvailable}
      LinkComponent={LinkComponent}
      onSendMessage={
        supportAvailable
          ? async (body) => {
              await sendMutation.mutateAsync(body);
            }
          : undefined
      }
      sending={sendMutation.isPending}
      sendError={sendMutation.error ? SYSTEM_UI.messageFailed : null}
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
