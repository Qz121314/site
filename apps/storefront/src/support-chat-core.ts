import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type {
  StartSupportConversationInput,
  SupportConversationDetail,
  SupportConversationSummary,
  SupportMessage,
} from './support-contract';
import { siteSupportGateway, SupportApiError } from './support-gateway';
import { prepareSupportImage, releaseSupportImage } from './support-image-compress';
import { subscribeSupportRealtime } from './support-realtime';
import {
  applyRealtimeToConversationCache,
  failSupportMessage,
  mergeSupportConversation,
  normalizeSupportConversation,
  replaceSupportMessage,
  type SupportConversationQueryCache,
  upsertSupportMessage,
} from './support-realtime-cache';
import {
  openSupportTypingChannel,
  type SupportTypingChannel,
} from './support-thread-realtime';

export type ChatCoreOptions = {
  conversationRef: string | null;
  startInput: StartSupportConversationInput | null;
};
const TYPING_IDLE_MS = 1_400;
const REMOTE_TYPING_STALE_MS = 3_000;

export function useSupportTypingCore(conversationRef: string | null) {
  const [agentTyping, setAgentTyping] = useState(false);
  const channelRef = useRef<SupportTypingChannel | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const remoteTimerRef = useRef<number | null>(null);
  useEffect(() => {
    let disposed = false;
    setAgentTyping(false);
    channelRef.current?.close();
    channelRef.current = null;
    if (!conversationRef || conversationRef === '__new__') return undefined;
    void openSupportTypingChannel(conversationRef, (active) => {
      if (disposed) return;
      if (remoteTimerRef.current !== null) window.clearTimeout(remoteTimerRef.current);
      setAgentTyping(active);
      remoteTimerRef.current = active
        ? window.setTimeout(() => setAgentTyping(false), REMOTE_TYPING_STALE_MS)
        : null;
    })
      .then((channel) => {
        if (disposed) channel.close();
        else channelRef.current = channel;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      channelRef.current?.close();
      channelRef.current = null;
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      if (remoteTimerRef.current !== null) window.clearTimeout(remoteTimerRef.current);
      idleTimerRef.current = null;
      remoteTimerRef.current = null;
    };
  }, [conversationRef]);
  function setTyping(value: string) {
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    const active = Boolean(value.trim());
    channelRef.current?.setTyping(active);
    idleTimerRef.current = active
      ? window.setTimeout(() => {
          idleTimerRef.current = null;
          channelRef.current?.setTyping(false);
        }, TYPING_IDLE_MS)
      : null;
  }
  return { agentTyping, setTyping };
}

function updateSummary(
  queryClient: ReturnType<typeof useQueryClient>,
  conversation: SupportConversationDetail,
) {
  const summary: SupportConversationSummary = {
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
  queryClient.setQueryData<SupportConversationSummary[]>(
    ['support-conversations'],
    (current) => [summary, ...(current ?? []).filter((item) => item.id !== summary.id)],
  );
}

export function useSupportChatCore({ conversationRef, startInput }: ChatCoreOptions) {
  const queryClient = useQueryClient();
  const typing = useSupportTypingCore(conversationRef);
  const [imageProgress, setImageProgress] = useState<number | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const conversationQuery = useQuery({
    queryKey: ['support-conversation', conversationRef],
    enabled: Boolean(conversationRef),
    queryFn: ({ signal }) =>
      conversationRef
        ? siteSupportGateway.getConversation(conversationRef, null, signal)
        : Promise.resolve(null),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const startQuery = useQuery({
    queryKey: ['support-conversation-start', startInput?.handoffId],
    enabled: Boolean(startInput && !conversationRef),
    queryFn: ({ signal }) => {
      if (!startInput) throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
      return siteSupportGateway.startConversation(startInput, signal);
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const activeRef = conversationRef ?? startQuery.data?.id ?? null;
  const conversation = conversationQuery.data ?? startQuery.data ?? null;
  useEffect(() => {
    if (startQuery.data)
      queryClient.setQueryData(
        ['support-conversation', startQuery.data.id],
        normalizeSupportConversation(startQuery.data),
      );
  }, [queryClient, startQuery.data]);
  useEffect(() => {
    if (!activeRef) return undefined;
    return subscribeSupportRealtime((event) => {
      if (event.type === 'realtime.recovered') {
        void queryClient.refetchQueries({
          queryKey: ['support-conversation', activeRef],
        });
        return;
      }
      if (event.conversationRef !== activeRef) return;
      queryClient.setQueryData<SupportConversationQueryCache>(
        ['support-conversation', activeRef],
        (current) => applyRealtimeToConversationCache(current, event),
      );
    });
  }, [activeRef, queryClient]);
  useEffect(() => {
    if (!activeRef || !conversation || conversation.unreadCount <= 0) return;
    const lastAgentMessage =
      [...conversation.messages]
        .reverse()
        .find((message) => message.direction === 'agent')?.id ?? null;
    void siteSupportGateway
      .markConversationRead(activeRef, lastAgentMessage)
      .then(() =>
        queryClient.setQueryData<SupportConversationQueryCache>(
          ['support-conversation', activeRef],
          (current) => (current ? { ...current, unreadCount: 0 } : current),
        ),
      )
      .catch(() => undefined);
  }, [activeRef, conversation, queryClient]);
  const earlierMutation = useMutation({
    mutationFn: ({ ref, cursor }: { ref: string; cursor: string }) =>
      siteSupportGateway.getConversation(ref, cursor),
    onSuccess: (page) => {
      if (page)
        queryClient.setQueryData<SupportConversationQueryCache>(
          ['support-conversation', page.id],
          (current) => mergeSupportConversation(current, page),
        );
    },
  });
  const sendMutation = useMutation({
    mutationFn: ({
      body,
      clientMessageId,
      ref,
    }: {
      body: string;
      clientMessageId: string;
      ref: string;
    }) => siteSupportGateway.sendMessage(ref, { body, clientMessageId }),
    onMutate: ({ body, clientMessageId, ref }) => {
      const message: SupportMessage = {
        id: `local:${clientMessageId}`,
        direction: 'customer',
        body,
        kind: 'text',
        productContext: null,
        sentAt: new Date().toISOString(),
        delivery: 'sending',
        attachments: [],
      };
      queryClient.setQueryData<SupportConversationQueryCache>(
        ['support-conversation', ref],
        (current) => (current ? upsertSupportMessage(current, message) : current),
      );
    },
    onSuccess: (message, { clientMessageId, ref }) => {
      queryClient.setQueryData<SupportConversationQueryCache>(
        ['support-conversation', ref],
        (current) =>
          current
            ? replaceSupportMessage(current, `local:${clientMessageId}`, message)
            : current,
      );
      const updated = queryClient.getQueryData<SupportConversationQueryCache>([
        'support-conversation',
        ref,
      ]);
      if (updated) updateSummary(queryClient, updated);
    },
    onError: (_error, { clientMessageId, ref }) =>
      queryClient.setQueryData<SupportConversationQueryCache>(
        ['support-conversation', ref],
        (current) =>
          current ? failSupportMessage(current, `local:${clientMessageId}`) : current,
      ),
  });
  const imageMutation = useMutation({
    mutationFn: async ({
      file,
      ref,
    }: {
      file: File;
      previewUrl: string;
      ref: string;
    }) => {
      const image = await prepareSupportImage(file);
      try {
        return await siteSupportGateway.sendImage(
          ref,
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
    onSuccess: (message, { previewUrl, ref }) => {
      queryClient.setQueryData<SupportConversationQueryCache>(
        ['support-conversation', ref],
        (current) => (current ? upsertSupportMessage(current, message) : current),
      );
      setImageProgress(null);
      setImagePreviewUrl((current) => (current === previewUrl ? null : current));
      URL.revokeObjectURL(previewUrl);
    },
    onError: () => setImageProgress(null),
  });
  async function send(body: string) {
    if (activeRef)
      await sendMutation.mutateAsync({
        body,
        clientMessageId: crypto.randomUUID(),
        ref: activeRef,
      });
  }
  async function retryMessage(message: SupportMessage) {
    if (activeRef)
      await sendMutation.mutateAsync({
        body: message.body,
        clientMessageId: message.id.startsWith('local:')
          ? message.id.slice(6)
          : crypto.randomUUID(),
        ref: activeRef,
      });
  }
  async function sendImage(file: File) {
    if (!activeRef) return;
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setImageProgress(0);
    try {
      await imageMutation.mutateAsync({ file, previewUrl, ref: activeRef });
    } catch {
      /* preview remains available */
    }
  }
  async function retryImage() {
    const variables = imageMutation.variables;
    if (!variables || imageMutation.isPending) return;
    setImageProgress(0);
    try {
      await imageMutation.mutateAsync(variables);
    } catch {
      /* preview remains available */
    }
  }
  const error = conversationQuery.error ?? startQuery.error ?? null;
  return {
    conversation,
    activeRef,
    loading: conversationQuery.isLoading || startQuery.isFetching,
    error,
    noAgent: error instanceof SupportApiError && error.code === 'NO_AGENT_AVAILABLE',
    agentTyping: typing.agentTyping,
    setTyping: typing.setTyping,
    send,
    retryMessage,
    sending: sendMutation.isPending,
    sendError: sendMutation.error,
    sendImage,
    retryImage,
    imageSending: imageMutation.isPending,
    imageFailed: imageMutation.isError && Boolean(imagePreviewUrl),
    imageProgress,
    imagePreviewUrl,
    imageError: imageMutation.error,
    loadEarlier: async () => {
      if (activeRef && conversation?.nextMessageCursor)
        await earlierMutation.mutateAsync({
          ref: activeRef,
          cursor: conversation.nextMessageCursor,
        });
    },
    loadingEarlier: earlierMutation.isPending,
    retryConnection: () => {
      if (conversationRef) void conversationQuery.refetch();
      else void startQuery.refetch();
    },
  };
}
