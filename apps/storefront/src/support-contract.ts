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

export type SupportImageAttachment = {
  id: string;
  kind: 'image';
  label: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  url: string;
};

export type SupportPhoneAttachment = {
  id: string;
  kind: 'phone';
  label: string;
  value: string;
};

export type SupportLinkAttachment = {
  id: string;
  kind: 'link';
  label: string;
  value: string;
};

export type SupportMessageAttachment =
  SupportImageAttachment | SupportPhoneAttachment | SupportLinkAttachment;

export type SupportMessage = {
  id: string;
  direction: 'customer' | 'agent';
  body: string;
  sentAt: string;
  delivery: 'sending' | 'failed' | 'sent' | 'read';
  attachments: SupportMessageAttachment[];
};

export type SupportConversationDetail = SupportConversationSummary & {
  productHref: string | null;
  createdAt: string;
  expiresAt: string;
  messages: SupportMessage[];
  nextMessageCursor: string | null;
};

export type StartSupportConversationInput = {
  handoffId: string;
  productId: string;
  sectionId: string;
  productTitle: string;
  productCoverUrl: string | null;
  productHref: string;
};

export type SendSupportMessageInput = {
  clientMessageId: string;
  body: string;
};

export type SendSupportImageInput = {
  blob: Blob;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  originalName: string;
};

/**
 * Browser boundary for the independent customer-service system.
 * Storefront reads only non-secret connection metadata from Site, then sends
 * conversation traffic directly to the customer-service origin.
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
  sendImage(
    conversationRef: string,
    input: SendSupportImageInput,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<SupportMessage>;
  markConversationRead(
    conversationRef: string,
    lastMessageId?: string | null,
    signal?: AbortSignal,
  ): Promise<void>;
}
