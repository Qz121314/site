import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  SupportConversationDetail,
  SupportConversationSummary,
  SupportMessage,
} from './support-contract';
import { ResilientImage } from './ResilientMedia';
import { SYSTEM_UI } from './system-ui';

export type PendingSupportConversation = {
  productTitle: string;
  productCoverUrl: string | null;
  productHref: string | null;
};

function MessageBubbleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
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
  const dayDifference = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000,
  );
  if (dayDifference === 0) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
  if (dayDifference === 1) return SYSTEM_UI.yesterday;
  if (dayDifference > 1 && dayDifference < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    date,
  );
}

function conversationTimestamp(conversation: SupportConversationSummary): number {
  if (!conversation.lastMessageAt) return 0;
  const timestamp = new Date(conversation.lastMessageAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function conversationTitle(conversation: SupportConversationSummary): string {
  return conversation.agentName?.trim() || conversation.productTitle;
}

function conversationPreview(conversation: SupportConversationSummary): string {
  const lastMessage = conversation.lastMessage?.trim() ?? '';
  return lastMessage
    ? `${conversation.productTitle} · ${lastMessage}`
    : conversation.productTitle;
}

function ConversationAvatar({
  conversation,
}: {
  conversation: SupportConversationSummary;
}) {
  if (conversation.agentAvatarUrl) {
    return (
      <ResilientImage
        alt=""
        fallback={
          <span aria-hidden="true">{conversationTitle(conversation).slice(0, 1)}</span>
        }
        loading="lazy"
        src={conversation.agentAvatarUrl}
      />
    );
  }
  return <span aria-hidden="true">{conversationTitle(conversation).slice(0, 1)}</span>;
}

export function MessagesPageContent({
  conversations,
  activeConversationId = null,
  supportAvailable = null,
  LinkComponent = 'a',
}: {
  conversations: SupportConversationSummary[];
  activeConversationId?: string | null;
  supportAvailable?: boolean | null;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const orderedConversations = [...conversations].sort(
    (left, right) => conversationTimestamp(right) - conversationTimestamp(left),
  );

  return (
    <section className="messages-page">
      {orderedConversations.length === 0 ? (
        <div className="messages-empty-state" role="status">
          <span className="messages-empty-icon" aria-hidden="true">
            <MessageBubbleIcon />
          </span>
          {supportAvailable === false ? <strong>{SYSTEM_UI.noSupport}</strong> : null}
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
                <span className="conversation-avatar">
                  <ConversationAvatar conversation={conversation} />
                </span>
                <span className="conversation-main">
                  <span className="conversation-heading-row">
                    <strong>{conversationTitle(conversation)}</strong>
                    <time>{formatConversationTime(conversation.lastMessageAt)}</time>
                  </span>
                  <span className="conversation-preview-row">
                    <span>{conversationPreview(conversation)}</span>
                    {isUnread ? (
                      <b aria-label={`${conversation.unreadCount} unread`}>
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

type ProductContext = {
  productTitle: string;
  productCoverUrl: string | null;
  productHref: string | null;
};

function ProductContextCard({
  context,
  LinkComponent,
}: {
  context: ProductContext;
  LinkComponent: StorefrontLinkComponent;
}) {
  const body = (
    <>
      <span className="chat-product-media">
        {context.productCoverUrl ? (
          <ResilientImage alt="" fallback={null} src={context.productCoverUrl} />
        ) : null}
      </span>
      <span className="chat-product-copy">
        <strong>{context.productTitle}</strong>
      </span>
      <span className="chat-product-chevron" aria-hidden="true">
        ›
      </span>
    </>
  );

  return context.productHref ? (
    <LinkComponent className="chat-product-card" href={context.productHref}>
      {body}
    </LinkComponent>
  ) : (
    <div className="chat-product-card">{body}</div>
  );
}

function DeliveryMark({ delivery }: { delivery: SupportMessage['delivery'] }) {
  if (delivery === 'sending') return <span aria-label={SYSTEM_UI.sending}>◷</span>;
  return (
    <span aria-label={delivery === 'read' ? SYSTEM_UI.read : SYSTEM_UI.sent}>
      {delivery === 'read' ? '✓✓' : '✓'}
    </span>
  );
}

export function MessageThreadPageContent({
  conversation,
  pendingConversation = null,
  LinkComponent = 'a',
  onSendMessage,
  sending = false,
  sendError = null,
  onLoadEarlier,
  loadingEarlier = false,
  loadingConversation = false,
}: {
  conversation: SupportConversationDetail | null;
  pendingConversation?: PendingSupportConversation | null;
  LinkComponent?: StorefrontLinkComponent;
  onSendMessage?: ((body: string) => Promise<void>) | undefined;
  sending?: boolean;
  sendError?: string | null;
  onLoadEarlier?: (() => Promise<void>) | undefined;
  loadingEarlier?: boolean;
  loadingConversation?: boolean;
}) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft('');
  }, [conversation?.id, pendingConversation?.productHref]);

  if (loadingConversation) {
    return (
      <section className="chat-page chat-page-unavailable" aria-busy="true">
        <div className="chat-timeline">
          <div className="chat-empty-state" aria-hidden="true">
            <MessageBubbleIcon />
          </div>
        </div>
      </section>
    );
  }

  if (!conversation && !pendingConversation) {
    return (
      <section className="chat-page chat-page-unavailable">
        <header className="chat-header">
          <LinkComponent
            className="chat-back-button"
            href="/messages/"
            aria-label={SYSTEM_UI.back}
          >
            ←
          </LinkComponent>
          <span className="chat-header-avatar" aria-hidden="true">
            <MessageBubbleIcon />
          </span>
        </header>
        <div className="chat-timeline">
          <div className="chat-empty-state" aria-hidden="true">
            <MessageBubbleIcon />
          </div>
        </div>
        <div className="chat-composer is-disabled" aria-disabled="true">
          <button type="button" disabled aria-label={SYSTEM_UI.attachment}>
            ＋
          </button>
          <div className="chat-input-placeholder">{SYSTEM_UI.message}</div>
          <button
            type="button"
            disabled
            className="chat-send-button"
            aria-label={SYSTEM_UI.send}
          >
            ➤
          </button>
        </div>
      </section>
    );
  }

  const productContext: ProductContext = pendingConversation ?? {
    productTitle: conversation?.productTitle ?? '',
    productCoverUrl: conversation?.productCoverUrl ?? null,
    productHref: conversation?.productHref ?? null,
  };
  const canSend =
    Boolean(onSendMessage) &&
    (pendingConversation !== null || conversation?.status !== 'closed');
  const headerTitle = conversation
    ? conversationTitle(conversation)
    : (pendingConversation?.productTitle ?? '');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !canSend || !onSendMessage || sending) return;
    try {
      await onSendMessage(body);
      setDraft('');
    } catch {
      // The parent owns the visible error state. Keep the draft intact for retry.
    }
  }

  return (
    <section className="chat-page">
      <header className="chat-header">
        <LinkComponent
          className="chat-back-button"
          href="/messages/"
          aria-label={SYSTEM_UI.back}
        >
          ←
        </LinkComponent>
        <span className="chat-header-avatar">
          {conversation ? (
            <ConversationAvatar conversation={conversation} />
          ) : (
            <MessageBubbleIcon />
          )}
        </span>
        {headerTitle ? (
          <span className="chat-header-copy">
            <strong>{headerTitle}</strong>
          </span>
        ) : null}
      </header>

      <ProductContextCard context={productContext} LinkComponent={LinkComponent} />

      <div className="chat-timeline" role="log" aria-live="polite">
        {conversation?.nextMessageCursor && onLoadEarlier ? (
          <button
            className="chat-load-earlier"
            type="button"
            disabled={loadingEarlier}
            onClick={() => void onLoadEarlier()}
          >
            {SYSTEM_UI.loadEarlier}
          </button>
        ) : null}
        {conversation?.messages.map((message) => (
          <div className={`chat-message-row is-${message.direction}`} key={message.id}>
            <div className="chat-message-bubble">
              <p>{message.body}</p>
              <span className="chat-message-meta">
                <time>{formatConversationTime(message.sentAt)}</time>
                {message.direction === 'customer' ? (
                  <DeliveryMark delivery={message.delivery} />
                ) : null}
              </span>
            </div>
          </div>
        ))}
      </div>

      {sendError ? (
        <p className="inline-error chat-send-error" role="alert">
          {sendError}
        </p>
      ) : null}
      <form
        className={`chat-composer${canSend ? '' : ' is-disabled'}`}
        onSubmit={(event) => void submit(event)}
      >
        <button type="button" disabled aria-label={SYSTEM_UI.attachment}>
          ＋
        </button>
        <textarea
          rows={1}
          aria-label={SYSTEM_UI.message}
          placeholder={SYSTEM_UI.message}
          value={draft}
          disabled={!canSend || sending}
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          disabled={!canSend || sending || !draft.trim()}
          className="chat-send-button"
          aria-label={SYSTEM_UI.send}
        >
          ➤
        </button>
      </form>
    </section>
  );
}

function MessagesDetailPlaceholder() {
  return (
    <div className="messages-detail-placeholder" aria-hidden="true">
      <MessageBubbleIcon />
    </div>
  );
}

export function MessagesWorkspace({
  conversations,
  activeConversation,
  activeConversationRef,
  pendingConversation = null,
  LinkComponent = 'a',
  onSendMessage,
  sending = false,
  sendError = null,
  onLoadEarlier,
  loadingEarlier = false,
  loadingConversation = false,
  supportAvailable = null,
}: {
  conversations: SupportConversationDetail[] | SupportConversationSummary[];
  activeConversation: SupportConversationDetail | null;
  activeConversationRef: string | null;
  pendingConversation?: PendingSupportConversation | null;
  LinkComponent?: StorefrontLinkComponent;
  onSendMessage?: ((body: string) => Promise<void>) | undefined;
  sending?: boolean;
  sendError?: string | null;
  onLoadEarlier?: (() => Promise<void>) | undefined;
  loadingEarlier?: boolean;
  loadingConversation?: boolean;
  supportAvailable?: boolean | null;
}) {
  const threadOpen = activeConversationRef !== null || pendingConversation !== null;
  return (
    <section className={`messages-workspace${threadOpen ? ' is-thread-open' : ''}`}>
      <aside className="messages-sidebar">
        <MessagesPageContent
          activeConversationId={activeConversation?.id ?? null}
          conversations={conversations}
          LinkComponent={LinkComponent}
          supportAvailable={supportAvailable}
        />
      </aside>
      <div className="messages-detail">
        {threadOpen ? (
          <MessageThreadPageContent
            conversation={activeConversation}
            pendingConversation={pendingConversation}
            LinkComponent={LinkComponent}
            onSendMessage={onSendMessage}
            sending={sending}
            sendError={sendError}
            onLoadEarlier={onLoadEarlier}
            loadingEarlier={loadingEarlier}
            loadingConversation={loadingConversation}
          />
        ) : (
          <MessagesDetailPlaceholder />
        )}
      </div>
    </section>
  );
}
