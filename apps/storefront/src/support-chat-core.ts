import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  StartSupportConversationInput,
  SupportConversationDetail,
  SupportMessage,
} from './support-contract';
import { siteSupportGateway, SupportApiError } from './support-gateway';
import { prepareSupportImage, releaseSupportImage } from './support-image-compress';
import { subscribeSupportRealtime } from './support-realtime';
import { openSupportTypingChannel } from './support-thread-realtime';

type ChatCoreOptions = {
  conversationRef: string | null;
  startInput: StartSupportConversationInput | null;
};

function appendMessage(
  conversation: SupportConversationDetail,
  message: SupportMessage,
): SupportConversationDetail {
  if (conversation.messages.some((item) => item.id === message.id)) return conversation;
  return {
    ...conversation,
    lastMessage: message.body,
    lastMessageAt: message.sentAt,
    messages: [...conversation.messages, message],
  };
}

export function useSupportChatCore({ conversationRef, startInput }: ChatCoreOptions) {
  const queryClient = useQueryClient();
  const [agentTyping, setAgentTyping] = useState(false);
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
    queryKey: ['support-landing-start', startInput?.handoffId],
    enabled: Boolean(startInput && !conversationRef),
    queryFn: ({ signal }) => {
      if (!startInput) throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
      return siteSupportGateway.startConversation(startInput, signal);
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const conversation = conversationQuery.data ?? startQuery.data ?? null;
  const activeRef = conversationRef ?? startQuery.data?.id ?? null;

  useEffect(() => {
    if (!startQuery.data) return;
    queryClient.setQueryData(
      ['support-conversation', startQuery.data.id],
      startQuery.data,
    );
  }, [queryClient, startQuery.data]);

  useEffect(() => {
    if (!activeRef) return;
    return subscribeSupportRealtime((event) => {
      if (event.conversationRef !== activeRef) return;
      if (event.message) {
        queryClient.setQueryData<SupportConversationDetail>(
          ['support-conversation', activeRef],
          (current) => (current ? appendMessage(current, event.message!) : current),
        );
      }
    });
  }, [activeRef, queryClient]);

  useEffect(() => {
    if (!activeRef) return;
    let closed = false;
    let typingChannel: Awaited<ReturnType<typeof openSupportTypingChannel>> | null = null;
    void openSupportTypingChannel(activeRef, (active) => {
      if (!closed) setAgentTyping(active);
    })
      .then((nextChannel) => {
        if (closed) nextChannel.close();
        else typingChannel = nextChannel;
      })
      .catch(() => undefined);
    return () => {
      closed = true;
      typingChannel?.close();
      setAgentTyping(false);
    };
  }, [activeRef]);

  useEffect(() => {
    if (!activeRef || !conversation || conversation.unreadCount <= 0) return;
    const lastAgentMessage =
      [...conversation.messages]
        .reverse()
        .find((message) => message.direction === 'agent')?.id ?? null;
    void siteSupportGateway
      .markConversationRead(activeRef, lastAgentMessage)
      .then(() => {
        queryClient.setQueryData<SupportConversationDetail>(
          ['support-conversation', activeRef],
          (current) => (current ? { ...current, unreadCount: 0 } : current),
        );
      })
      .catch(() => undefined);
  }, [activeRef, conversation, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async ({
      body,
      clientMessageId,
    }: {
      body: string;
      clientMessageId: string;
    }) => {
      if (!activeRef) throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
      return siteSupportGateway.sendMessage(activeRef, { body, clientMessageId });
    },
    onMutate: ({ body, clientMessageId }) => {
      if (!activeRef) return;
      const optimistic: SupportMessage = {
        id: `local:${clientMessageId}`,
        direction: 'customer',
        body,
        kind: 'text',
        productContext: null,
        sentAt: new Date().toISOString(),
        delivery: 'sending',
        attachments: [],
      };
      queryClient.setQueryData<SupportConversationDetail>(
        ['support-conversation', activeRef],
        (current) => (current ? appendMessage(current, optimistic) : current),
      );
    },
    onSuccess: (message, { clientMessageId }) => {
      if (!activeRef) return;
      queryClient.setQueryData<SupportConversationDetail>(
        ['support-conversation', activeRef],
        (current) =>
          current
            ? {
                ...current,
                messages: current.messages.map((item) =>
                  item.id === `local:${clientMessageId}` ? message : item,
                ),
                lastMessage: message.body,
                lastMessageAt: message.sentAt,
              }
            : current,
      );
    },
    onError: (_error, { clientMessageId }) => {
      if (!activeRef) return;
      queryClient.setQueryData<SupportConversationDetail>(
        ['support-conversation', activeRef],
        (current) =>
          current
            ? {
                ...current,
                messages: current.messages.map((item) =>
                  item.id === `local:${clientMessageId}`
                    ? { ...item, delivery: 'failed' as const }
                    : item,
                ),
              }
            : current,
      );
    },
  });

  const imageMutation = useMutation({
    mutationFn: async ({ file }: { file: File; previewUrl: string }) => {
      if (!activeRef) throw new Error('MESSAGE_CONTEXT_UNAVAILABLE');
      const image = await prepareSupportImage(file);
      try {
        return await siteSupportGateway.sendImage(
          activeRef,
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
    onSuccess: (message, { previewUrl }) => {
      if (activeRef) {
        queryClient.setQueryData<SupportConversationDetail>(
          ['support-conversation', activeRef],
          (current) => (current ? appendMessage(current, message) : current),
        );
      }
      setImageProgress(null);
      setImagePreviewUrl((current) => (current === previewUrl ? null : current));
      URL.revokeObjectURL(previewUrl);
    },
    onError: () => setImageProgress(null),
  });

  async function send(body: string) {
    await sendMutation.mutateAsync({ body, clientMessageId: crypto.randomUUID() });
  }

  async function retryMessage(message: SupportMessage) {
    await sendMutation.mutateAsync({
      body: message.body,
      clientMessageId: message.id.startsWith('local:')
        ? message.id.slice('local:'.length)
        : crypto.randomUUID(),
    });
  }

  async function sendImage(file: File) {
    if (!activeRef) return;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setImageProgress(0);
    try {
      await imageMutation.mutateAsync({ file, previewUrl });
    } catch {
      // The preview remains available for retry.
    }
  }

  async function retryImage() {
    const variables = imageMutation.variables;
    if (!variables || imageMutation.isPending) return;
    setImageProgress(0);
    try {
      await imageMutation.mutateAsync(variables);
    } catch {
      // The preview remains available for another retry.
    }
  }

  const error = conversationQuery.error ?? startQuery.error ?? null;
  const noAgent = error instanceof SupportApiError && error.code === 'NO_AGENT_AVAILABLE';
  return {
    conversation,
    activeRef,
    loading: conversationQuery.isLoading || startQuery.isFetching,
    error,
    noAgent,
    agentTyping,
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
    retryConnection: () => {
      if (conversationRef) void conversationQuery.refetch();
      else void startQuery.refetch();
    },
  };
}
