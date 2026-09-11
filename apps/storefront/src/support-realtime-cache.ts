import type {
  SupportConversationDetail,
  SupportConversationSummary,
  SupportMessage,
} from './support-contract';
import type { SupportRealtimeEvent } from './support-realtime';

export type SupportConversationQueryCache = SupportConversationDetail;

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeMessages(
  current: SupportMessage[],
  incoming: SupportMessage[],
): SupportMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    byId.set(message.id, {
      ...previous,
      ...message,
      attachments:
        message.attachments.length > 0
          ? message.attachments
          : (previous?.attachments ?? []),
    });
  }
  return [...byId.values()].sort(
    (left, right) => timestamp(left.sentAt) - timestamp(right.sentAt),
  );
}

export function normalizeSupportConversation(
  conversation: SupportConversationDetail,
): SupportConversationDetail {
  return { ...conversation, messages: mergeMessages([], conversation.messages) };
}

export function mergeSupportConversation(
  current: SupportConversationDetail | undefined,
  incoming: SupportConversationDetail,
): SupportConversationDetail {
  if (!current) return normalizeSupportConversation(incoming);
  return normalizeSupportConversation({
    ...current,
    ...incoming,
    messages: mergeMessages(current.messages, incoming.messages),
    nextMessageCursor: incoming.nextMessageCursor,
  });
}

export function upsertSupportMessage(
  current: SupportConversationDetail,
  message: SupportMessage,
): SupportConversationDetail {
  return normalizeSupportConversation({
    ...current,
    messages: mergeMessages(current.messages, [message]),
    lastMessage: message.body,
    lastMessageAt: message.sentAt,
  });
}

export function replaceSupportMessage(
  current: SupportConversationDetail,
  optimisticId: string,
  message: SupportMessage,
): SupportConversationDetail {
  return {
    ...current,
    messages: current.messages.map((item) => (item.id === optimisticId ? message : item)),
    lastMessage: message.body,
    lastMessageAt: message.sentAt,
  };
}

export function failSupportMessage(
  current: SupportConversationDetail,
  optimisticId: string,
): SupportConversationDetail {
  return {
    ...current,
    messages: current.messages.map((item) =>
      item.id === optimisticId ? { ...item, delivery: 'failed' as const } : item,
    ),
  };
}

export function applyRealtimeToConversationList(
  current: SupportConversationSummary[] | undefined,
  event: SupportRealtimeEvent,
): SupportConversationSummary[] | undefined {
  if (!current || !event.conversation) return current;
  const next = event.conversation;
  return [next, ...current.filter((item) => item.id !== next.id)].sort(
    (left, right) => timestamp(right.lastMessageAt) - timestamp(left.lastMessageAt),
  );
}

function applyReadState(
  messages: SupportMessage[],
  reader: SupportRealtimeEvent['reader'],
  lastMessageId: string | null,
): SupportMessage[] {
  if (!reader) return messages;
  const direction = reader === 'agent' ? 'customer' : 'agent';
  const boundary = lastMessageId
    ? timestamp(messages.find((item) => item.id === lastMessageId)?.sentAt ?? null)
    : Number.POSITIVE_INFINITY;
  return messages.map((message) =>
    message.direction === direction &&
    message.delivery === 'sent' &&
    timestamp(message.sentAt) <= boundary
      ? { ...message, delivery: 'read' as const }
      : message,
  );
}

export function applyRealtimeToConversationCache(
  current: SupportConversationQueryCache | undefined,
  event: SupportRealtimeEvent,
): SupportConversationQueryCache | undefined {
  if (!current || !event.conversationRef || current.id !== event.conversationRef)
    return current;
  const summary = event.conversation;
  let messages = event.message
    ? mergeMessages(current.messages, [event.message])
    : current.messages;
  if (event.type === 'message.read')
    messages = applyReadState(messages, event.reader, event.lastMessageId);
  return normalizeSupportConversation({
    ...current,
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
  });
}
