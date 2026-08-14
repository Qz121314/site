import type {
  SupportConversationDetail,
  SupportConversationSummary,
  SupportMessage,
} from './support-contract';
import type { SupportRealtimeEvent } from './support-realtime';

export type SupportConversationQueryCache = {
  pages: Array<SupportConversationDetail | null>;
  pageParams: Array<string | null>;
};

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function applyRealtimeToConversationList(
  current: SupportConversationSummary[] | undefined,
  event: SupportRealtimeEvent,
): SupportConversationSummary[] | undefined {
  if (!current || !event.conversation) return current;
  const next = event.conversation;
  const withoutCurrent = current.filter((item) => item.id !== next.id);
  return [next, ...withoutCurrent].sort(
    (left, right) => timestamp(right.lastMessageAt) - timestamp(left.lastMessageAt),
  );
}

function mergeMessage(
  messages: SupportMessage[],
  incoming: SupportMessage,
): SupportMessage[] {
  const existing = messages.find((message) => message.id === incoming.id);
  if (!existing) return [...messages, incoming];
  return messages.map((message) =>
    message.id === incoming.id
      ? {
          ...message,
          ...incoming,
          attachments:
            incoming.attachments.length > 0 ? incoming.attachments : message.attachments,
        }
      : message,
  );
}

function applyReadState(
  messages: SupportMessage[],
  reader: SupportRealtimeEvent['reader'],
): SupportMessage[] {
  if (!reader) return messages;
  const direction = reader === 'agent' ? 'customer' : 'agent';
  return messages.map((message) =>
    message.direction === direction && message.delivery === 'sent'
      ? { ...message, delivery: 'read' as const }
      : message,
  );
}

export function applyRealtimeToConversationCache(
  current: SupportConversationQueryCache | undefined,
  event: SupportRealtimeEvent,
): SupportConversationQueryCache | undefined {
  if (!current || !event.conversationRef) return current;
  const first = current.pages[0];
  if (!first || first.id !== event.conversationRef) return current;

  let messages = first.messages;
  if (event.message) messages = mergeMessage(messages, event.message);
  if (event.type === 'message.read') messages = applyReadState(messages, event.reader);

  const summary = event.conversation;
  const updated: SupportConversationDetail = {
    ...first,
    ...(summary
      ? {
          agentName: summary.agentName,
          agentAvatarUrl: summary.agentAvatarUrl,
          productTitle: summary.productTitle,
          productCoverUrl: summary.productCoverUrl,
          lastMessage: summary.lastMessage,
          lastMessageAt: summary.lastMessageAt,
          unreadCount: summary.unreadCount,
          status: summary.status,
        }
      : {}),
    ...(event.type === 'message.read' && event.reader === 'visitor'
      ? { unreadCount: 0 }
      : {}),
    messages,
  };
  return { ...current, pages: [updated, ...current.pages.slice(1)] };
}
