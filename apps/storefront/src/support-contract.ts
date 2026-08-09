export type SupportConversationStatus = 'waiting' | 'active' | 'closed';

export type SupportConversationSummary = {
  id: string;
  agentName: string | null;
  agentAvatarUrl: string | null;
  productTitle: string;
  productCoverUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: SupportConversationStatus;
};

export type SupportMessage = {
  id: string;
  direction: 'customer' | 'agent';
  body: string;
  sentAt: string;
  delivery: 'sending' | 'sent' | 'read';
};

export type SupportConversationDetail = SupportConversationSummary & {
  productHref: string | null;
  createdAt: string;
  expiresAt: string;
  messages: SupportMessage[];
  nextMessageCursor: string | null;
};

export type StartSupportConversationInput = {
  productId: string;
  sectionId: string;
  clientMessageId: string;
  message: string;
};

export type SendSupportMessageInput = {
  clientMessageId: string;
  body: string;
};

/**
 * Provider-neutral boundary consumed by the Storefront Messages UI.
 * Implementations call same-origin Site Worker routes only; provider URLs,
 * credentials, visitor headers and upstream conversation IDs never belong in
 * the browser.
 */
export interface SupportGateway {
  listConversations(signal?: AbortSignal): Promise<SupportConversationSummary[]>;
  getConversation(
    conversationRef: string,
    before?: string | null,
    signal?: AbortSignal,
  ): Promise<SupportConversationDetail | null>;
  startConversation(
    input: StartSupportConversationInput,
    signal?: AbortSignal,
  ): Promise<SupportConversationDetail>;
  sendMessage(
    conversationRef: string,
    input: SendSupportMessageInput,
    signal?: AbortSignal,
  ): Promise<SupportMessage>;
  markConversationRead(
    conversationRef: string,
    lastMessageId?: string | null,
    signal?: AbortSignal,
  ): Promise<void>;
}
