import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useStorefrontCopy } from './storefront-copy';

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
};

function MessageBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M20 11.6a7.6 7.6 0 0 1-8 7.2 8.8 8.8 0 0 1-3.2-.7L4 19.5l1.4-4.2a7 7 0 0 1-1.1-3.7 7.6 7.6 0 0 1 8-7.2 7.6 7.6 0 0 1 7.7 7.2Z" />
      <path d="M8.5 11.7h.01M12 11.7h.01M15.5 11.7h.01" strokeLinecap="round" />
    </svg>
  );
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatConversationTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const dayDifference = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000);
  if (dayDifference === 0) {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  if (dayDifference === 1) return 'Yesterday';
  if (dayDifference > 1 && dayDifference < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function conversationTimestamp(conversation: SupportConversationSummary): number {
  if (!conversation.lastMessageAt) return 0;
  const timestamp = new Date(conversation.lastMessageAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function conversationTitle(conversation: SupportConversationSummary, supportName: string): string {
  return conversation.agentName?.trim() || supportName;
}

function conversationPreview(conversation: SupportConversationSummary, waitingPreview: string): string {
  const lastMessage = conversation.lastMessage?.trim()
    || (conversation.status === 'waiting' ? waitingPreview : '');
  return lastMessage ? `${conversation.productTitle} · ${lastMessage}` : conversation.productTitle;
}

function ConversationAvatar({ conversation }: { conversation: SupportConversationSummary }) {
  const { messages } = useStorefrontCopy();
  if (conversation.agentAvatarUrl) {
    return <img src={conversation.agentAvatarUrl} alt="" loading="lazy" />;
  }
  return <span aria-hidden="true">{conversationTitle(conversation, messages.supportName).slice(0, 1)}</span>;
}

export function MessagesPageContent({
  conversations,
  activeConversationId = null,
  LinkComponent = 'a',
}: {
  conversations: SupportConversationSummary[];
  activeConversationId?: string | null;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const { messages } = useStorefrontCopy();
  const orderedConversations = [...conversations].sort(
    (left, right) => conversationTimestamp(right) - conversationTimestamp(left),
  );

  return (
    <section className="messages-page" aria-labelledby="messages-title">
      <header className="messages-page-heading">
        <h1 id="messages-title">{messages.title}</h1>
      </header>

      {orderedConversations.length === 0 ? (
        <div className="messages-empty-state">
          <span className="messages-empty-icon"><MessageBubbleIcon /></span>
          <strong>{messages.emptyTitle}</strong>
          <p>{messages.emptyDescription}</p>
        </div>
      ) : (
        <div className="conversation-list" role="list">
          {orderedConversations.map((conversation) => {
            const isActive = activeConversationId === conversation.id;
            const isUnread = conversation.unreadCount > 0;
            return (
              <LinkComponent
                aria-current={isActive ? 'page' : undefined}
                className={`conversation-row${isActive ? ' is-active' : ''}${isUnread ? ' is-unread' : ''}`}
                href={`/messages/${encodeURIComponent(conversation.id)}/`}
                key={conversation.id}
              >
                <span className="conversation-avatar"><ConversationAvatar conversation={conversation} /></span>
                <span className="conversation-main">
                  <span className="conversation-heading-row">
                    <strong>{conversationTitle(conversation, messages.supportName)}</strong>
                    <time>{formatConversationTime(conversation.lastMessageAt)}</time>
                  </span>
                  <span className="conversation-preview-row">
                    <span>{conversationPreview(conversation, messages.waitingPreview)}</span>
                    {isUnread ? (
                      <b aria-label={`${conversation.unreadCount} unread messages`}>
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </b>
                    ) : null}
                  </span>
                </span>
              </LinkComponent>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProductContextCard({
  conversation,
  LinkComponent,
}: {
  conversation: SupportConversationDetail;
  LinkComponent: StorefrontLinkComponent;
}) {
  const { messages } = useStorefrontCopy();
  const body = (
    <>
      <span className="chat-product-media">
        {conversation.productCoverUrl ? <img src={conversation.productCoverUrl} alt="" /> : null}
      </span>
      <span className="chat-product-copy">
        <small>{messages.productLabel}</small>
        <strong>{conversation.productTitle}</strong>
      </span>
      <span className="chat-product-chevron" aria-hidden="true">›</span>
    </>
  );

  return conversation.productHref ? (
    <LinkComponent className="chat-product-card" href={conversation.productHref}>{body}</LinkComponent>
  ) : (
    <div className="chat-product-card">{body}</div>
  );
}

function DeliveryMark({ delivery }: { delivery: SupportMessage['delivery'] }) {
  if (delivery === 'sending') return <span aria-label="sending">◷</span>;
  return <span aria-label={delivery === 'read' ? 'read' : 'sent'}>{delivery === 'read' ? '✓✓' : '✓'}</span>;
}

export function MessageThreadPageContent({
  conversation,
  LinkComponent = 'a',
}: {
  conversation: SupportConversationDetail | null;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const { messages } = useStorefrontCopy();
  if (!conversation) {
    return (
      <section className="chat-page chat-page-unavailable" aria-labelledby="chat-title">
        <header className="chat-header">
          <LinkComponent className="chat-back-button" href="/messages/" aria-label={messages.backLabel}>←</LinkComponent>
          <span className="chat-header-avatar"><MessageBubbleIcon /></span>
          <span className="chat-header-copy">
            <strong id="chat-title">{messages.supportName}</strong>
            <small>{messages.noActiveConversation}</small>
          </span>
        </header>
        <div className="chat-timeline">
          <div className="chat-empty-state">
            <MessageBubbleIcon />
            <strong>{messages.unavailableTitle}</strong>
            <p>{messages.unavailableDescription}</p>
          </div>
        </div>
        <div className="chat-composer is-disabled" aria-disabled="true">
          <button type="button" disabled aria-label="Add attachment">＋</button>
          <div className="chat-input-placeholder">{messages.inputPlaceholder}</div>
          <button type="button" disabled className="chat-send-button" aria-label="Send message">➤</button>
        </div>
      </section>
    );
  }

  const statusLabel = conversation.status === 'waiting'
    ? messages.waitingStatus
    : conversation.status === 'active'
      ? messages.activeStatus
      : messages.closedStatus;

  return (
    <section className="chat-page" aria-labelledby="chat-title">
      <header className="chat-header">
        <LinkComponent className="chat-back-button" href="/messages/" aria-label={messages.backLabel}>←</LinkComponent>
        <span className="chat-header-avatar"><ConversationAvatar conversation={conversation} /></span>
        <span className="chat-header-copy">
          <strong id="chat-title">{conversationTitle(conversation, messages.supportName)}</strong>
          <small>{statusLabel}</small>
        </span>
      </header>

      <ProductContextCard conversation={conversation} LinkComponent={LinkComponent} />

      <div className="chat-timeline" role="log" aria-live="polite">
        {conversation.messages.map((message) => (
          <div className={`chat-message-row is-${message.direction}`} key={message.id}>
            <div className="chat-message-bubble">
              <p>{message.body}</p>
              <span className="chat-message-meta">
                <time>{formatConversationTime(message.sentAt)}</time>
                {message.direction === 'customer' ? <DeliveryMark delivery={message.delivery} /> : null}
              </span>
            </div>
          </div>
        ))}
      </div>

      <form className="chat-composer" onSubmit={(event) => event.preventDefault()}>
        <button type="button" aria-label="Add attachment">＋</button>
        <textarea rows={1} aria-label={messages.inputPlaceholder} placeholder={messages.inputPlaceholder} />
        <button type="submit" className="chat-send-button" aria-label="Send message">➤</button>
      </form>
    </section>
  );
}

function MessagesDetailPlaceholder() {
  return (
    <div className="messages-detail-placeholder" aria-hidden="true">
      <MessageBubbleIcon />
      <strong>Select a conversation</strong>
      <p>Choose a conversation from the list to continue messaging.</p>
    </div>
  );
}

export function MessagesWorkspace({
  conversations,
  activeConversation,
  activeConversationRef,
  LinkComponent = 'a',
}: {
  conversations: SupportConversationDetail[];
  activeConversation: SupportConversationDetail | null;
  activeConversationRef: string | null;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const threadOpen = activeConversationRef !== null;
  return (
    <section className={`messages-workspace${threadOpen ? ' is-thread-open' : ''}`}>
      <aside className="messages-sidebar">
        <MessagesPageContent
          activeConversationId={activeConversation?.id ?? null}
          conversations={conversations}
          LinkComponent={LinkComponent}
        />
      </aside>
      <div className="messages-detail">
        {threadOpen ? (
          <MessageThreadPageContent conversation={activeConversation} LinkComponent={LinkComponent} />
        ) : (
          <MessagesDetailPlaceholder />
        )}
      </div>
    </section>
  );
}
