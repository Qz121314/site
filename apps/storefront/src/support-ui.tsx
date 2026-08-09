import type { StorefrontLinkComponent } from '@site/storefront-ui';

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

function formatConversationTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function conversationTitle(conversation: SupportConversationSummary): string {
  return conversation.agentName?.trim() || 'Customer Support';
}

function ConversationAvatar({ conversation }: { conversation: SupportConversationSummary }) {
  if (conversation.agentAvatarUrl) {
    return <img src={conversation.agentAvatarUrl} alt="" loading="lazy" />;
  }
  return <span aria-hidden="true">{conversationTitle(conversation).slice(0, 1)}</span>;
}

export function MessagesPageContent({
  conversations,
  LinkComponent = 'a',
}: {
  conversations: SupportConversationSummary[];
  LinkComponent?: StorefrontLinkComponent;
}) {
  return (
    <section className="messages-page" aria-labelledby="messages-title">
      <header className="app-page-heading messages-page-heading">
        <div>
          <p className="app-page-kicker">Customer service</p>
          <h1 id="messages-title">Messages</h1>
        </div>
        <span className="conversation-capacity" aria-label={`${conversations.length} of 10 conversations`}>
          {conversations.length}/10
        </span>
      </header>

      {conversations.length === 0 ? (
        <div className="messages-empty-state">
          <span className="messages-empty-icon"><MessageBubbleIcon /></span>
          <strong>No conversations yet</strong>
          <p>Start a consultation from a product page. Your conversations will appear here.</p>
        </div>
      ) : (
        <div className="conversation-list" role="list">
          {conversations.map((conversation) => (
            <LinkComponent
              className="conversation-row"
              href={`/messages/${encodeURIComponent(conversation.id)}/`}
              key={conversation.id}
            >
              <span className="conversation-avatar"><ConversationAvatar conversation={conversation} /></span>
              <span className="conversation-main">
                <span className="conversation-heading-row">
                  <strong>{conversationTitle(conversation)}</strong>
                  <time>{formatConversationTime(conversation.lastMessageAt)}</time>
                </span>
                <small>{conversation.productTitle}</small>
                <span className="conversation-preview-row">
                  <span>{conversation.lastMessage || (conversation.status === 'waiting' ? 'Waiting for an agent…' : '')}</span>
                  {conversation.unreadCount > 0 ? (
                    <b aria-label={`${conversation.unreadCount} unread messages`}>
                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                    </b>
                  ) : null}
                </span>
              </span>
            </LinkComponent>
          ))}
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
  const body = (
    <>
      <span className="chat-product-media">
        {conversation.productCoverUrl ? <img src={conversation.productCoverUrl} alt="" /> : null}
      </span>
      <span className="chat-product-copy">
        <small>Product</small>
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
  if (!conversation) {
    return (
      <section className="chat-page chat-page-unavailable" aria-labelledby="chat-title">
        <header className="chat-header">
          <LinkComponent className="chat-back-button" href="/messages/" aria-label="Back to messages">←</LinkComponent>
          <span className="chat-header-avatar"><MessageBubbleIcon /></span>
          <span className="chat-header-copy">
            <strong id="chat-title">Customer Support</strong>
            <small>No active conversation</small>
          </span>
        </header>
        <div className="chat-timeline">
          <div className="chat-empty-state">
            <MessageBubbleIcon />
            <strong>Conversation not found or has ended</strong>
            <p>Go back to Messages, or start a new consultation from a product page.</p>
          </div>
        </div>
        <div className="chat-composer is-disabled" aria-disabled="true">
          <button type="button" disabled aria-label="Add attachment">＋</button>
          <div className="chat-input-placeholder">Type a message</div>
          <button type="button" disabled className="chat-send-button" aria-label="Send message">➤</button>
        </div>
      </section>
    );
  }

  return (
    <section className="chat-page" aria-labelledby="chat-title">
      <header className="chat-header">
        <LinkComponent className="chat-back-button" href="/messages/" aria-label="Back to messages">←</LinkComponent>
        <span className="chat-header-avatar"><ConversationAvatar conversation={conversation} /></span>
        <span className="chat-header-copy">
          <strong id="chat-title">{conversationTitle(conversation)}</strong>
          <small>{conversation.status === 'waiting' ? 'Connecting to support' : conversation.status === 'active' ? 'Customer support' : 'Conversation ended'}</small>
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
        <textarea rows={1} aria-label="Type a message" placeholder="Type a message" />
        <button type="submit" className="chat-send-button" aria-label="Send message">➤</button>
      </form>
    </section>
  );
}
