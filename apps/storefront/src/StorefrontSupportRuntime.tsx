import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { SupportConversationSummary } from './support-contract';
import { siteSupportGateway } from './support-gateway';
import { syncSupportAppBadge } from './support-push';
import { subscribeSupportRealtime } from './support-realtime';
import { createSupportRecoveryCoordinator } from './support-recovery-coordinator';
import {
  applyRealtimeToConversationCache,
  applyRealtimeToConversationList,
  type SupportConversationQueryCache,
} from './support-realtime-cache';

export function StorefrontSupportRuntime({
  conversationListEnabled,
  onUnreadMessages,
}: {
  conversationListEnabled: boolean;
  onUnreadMessages: (count: number) => void;
}) {
  const queryClient = useQueryClient();
  const supportConversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    enabled: conversationListEnabled,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const unreadMessages = (supportConversationsQuery.data ?? []).reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );
  const recoverSupport = useMemo(
    () =>
      createSupportRecoveryCoordinator(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['support-conversations'] }),
          queryClient.invalidateQueries({ queryKey: ['support-conversation'] }),
        ]);
      }).recover,
    [queryClient],
  );

  useEffect(() => {
    onUnreadMessages(unreadMessages);
    void syncSupportAppBadge(unreadMessages);
  }, [onUnreadMessages, unreadMessages]);

  useEffect(
    () => () => {
      onUnreadMessages(0);
    },
    [onUnreadMessages],
  );

  useEffect(() => {
    return subscribeSupportRealtime((event) => {
      if (event.type === 'realtime.recovered') {
        void recoverSupport();
        return;
      }
      if (event.type === 'realtime.connected') return;
      queryClient.setQueryData<SupportConversationSummary[]>(
        ['support-conversations'],
        (current) => applyRealtimeToConversationList(current, event),
      );
      if (event.conversationRef) {
        queryClient.setQueryData<SupportConversationQueryCache>(
          ['support-conversation', event.conversationRef],
          (current) => applyRealtimeToConversationCache(current, event),
        );
      }
    });
  }, [queryClient, recoverSupport]);

  return null;
}
