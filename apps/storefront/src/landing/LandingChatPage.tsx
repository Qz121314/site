import { useQuery } from '@tanstack/react-query';
import { CircleAlert, ChevronLeft, RotateCcw, SendHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MarkdownContent } from '../MarkdownContent';
import { RouteProgress } from '../LoadingStates';
import { ResilientImage } from '../ResilientMedia';
import { replaceStorefrontLocation } from '../storefront-navigation-runtime';
import { useSupportChatCore } from '../support-chat-core';
import type { SupportMessage } from '../support-contract';
import { PublicContentError } from '../content';
import { loadLandingSnapshot } from './landing-content';
import './landing-chat.css';

const HANDOFF_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readContext(slug: string) {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('productId')?.trim() ?? '';
  const sectionId = params.get('sectionId')?.trim() ?? '';
  const handoffId = params.get('handoffId')?.trim() ?? '';
  const landingSlug = params.get('landingSlug')?.trim() ?? '';
  if (
    landingSlug !== slug ||
    !productId ||
    !sectionId ||
    !HANDOFF_ID_PATTERN.test(handoffId) ||
    productId.length > 120 ||
    sectionId.length > 120
  )
    return null;
  return { productId, sectionId, handoffId };
}

function messageImage(message: SupportMessage) {
  return message.attachments.find((attachment) => attachment.kind === 'image') ?? null;
}

export function LandingChatPage({
  slug,
  conversationRef,
}: {
  slug: string;
  conversationRef: string | null;
}) {
  const context = readContext(slug);
  const snapshotQuery = useQuery({
    queryKey: ['landing-publication', slug],
    queryFn: ({ signal }) => loadLandingSnapshot(slug, signal),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const snapshot = snapshotQuery.data;
  const startInput =
    context && snapshot && !conversationRef
      ? {
          handoffId: context.handoffId,
          productId: context.productId,
          sectionId: context.sectionId,
          productTitle: snapshot.model.product.title,
          productCoverUrl: snapshot.model.product.effectiveCoverUrl,
          productHref: `/sections/${encodeURIComponent(context.sectionId)}/products/${encodeURIComponent(context.productId)}/`,
        }
      : null;
  const chat = useSupportChatCore({ conversationRef, startInput });
  const [draft, setDraft] = useState('');
  const conversation = chat.conversation;
  const activeConversationRef = chat.activeRef;
  const conversationHref =
    context && activeConversationRef
      ? `/l/${encodeURIComponent(slug)}/chat/${encodeURIComponent(activeConversationRef)}/?${new URLSearchParams(
          {
            landingSlug: slug,
            productId: context.productId,
            sectionId: context.sectionId,
            handoffId: context.handoffId,
          },
        ).toString()}`
      : null;

  useEffect(() => {
    if (conversation && !conversationRef && conversationHref) {
      replaceStorefrontLocation(conversationHref);
    }
  }, [conversation, conversationHref, conversationRef]);

  if (snapshotQuery.isLoading) return <RouteProgress />;
  const restoredContext = chat.conversation
    ? {
        productId: chat.conversation.productId,
        sectionId: chat.conversation.sectionId,
        handoffId: context?.handoffId ?? '',
      }
    : context;
  if ((!restoredContext && !conversationRef) || snapshotQuery.error || !snapshot) {
    return (
      <div className="landing-chat-state" role="alert">
        <CircleAlert aria-hidden="true" />
        <h1>Chat unavailable</h1>
        <p>
          {snapshotQuery.error instanceof PublicContentError
            ? 'This landing page is unavailable.'
            : 'The chat context is invalid or expired.'}
        </p>
        <a href={`/l/${encodeURIComponent(slug)}/`}>Back to landing</a>
      </div>
    );
  }
  if (conversationRef && chat.loading && !chat.conversation) return <RouteProgress />;
  if (
    !restoredContext ||
    snapshot.model.product.id !== restoredContext.productId ||
    snapshot.model.product.sectionId !== restoredContext.sectionId
  ) {
    return (
      <div className="landing-chat-state" role="alert">
        This chat context is invalid.
      </div>
    );
  }

  const backHref = `/l/${encodeURIComponent(slug)}/`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || !conversation || conversation.status === 'closed' || chat.sending)
      return;
    setDraft('');
    try {
      await chat.send(value);
    } catch {
      setDraft(value);
    }
  }

  return (
    <main className="landing-chat" aria-busy={chat.loading || undefined}>
      <header className="landing-chat-header">
        <a href={backHref} aria-label="Back to landing">
          <ChevronLeft aria-hidden="true" />
        </a>
        <div>
          <strong>{conversation?.agentName || snapshot.model.product.title}</strong>
          <span>
            {conversation?.status === 'closed' ? 'Conversation closed' : 'Online'}
          </span>
        </div>
      </header>
      <section className="landing-chat-product" aria-label="Product">
        {snapshot.model.product.effectiveCoverUrl ? (
          <ResilientImage alt="" src={snapshot.model.product.effectiveCoverUrl} />
        ) : null}
        <div>
          <strong>{snapshot.model.product.title}</strong>
          <span>{snapshot.model.landing.name}</span>
        </div>
      </section>
      {snapshot.model.resolved.chatWelcome ? (
        <div className="landing-chat-welcome">
          <MarkdownContent source={snapshot.model.resolved.chatWelcome} />
        </div>
      ) : null}
      <div className="landing-chat-messages" role="log" aria-live="polite">
        {chat.loading && !conversation ? <p role="status">Connecting…</p> : null}
        {chat.noAgent ? (
          <p className="landing-chat-error" role="alert">
            Customer service is currently unavailable.
          </p>
        ) : null}
        {chat.error && !chat.noAgent ? (
          <div className="landing-chat-error" role="alert">
            <span>Unable to load chat.</span>
            <button type="button" onClick={chat.retryConnection}>
              <RotateCcw aria-hidden="true" /> Retry
            </button>
          </div>
        ) : null}
        {conversation?.messages.map((message) => {
          const image = messageImage(message);
          return (
            <article
              className={`landing-chat-message is-${message.direction}${message.delivery === 'failed' ? ' is-failed' : ''}`}
              key={message.id}
            >
              {message.body ? <p>{message.body}</p> : null}
              {image ? <img src={image.url} alt={image.label} loading="lazy" /> : null}
              {message.delivery === 'failed' ? (
                <button type="button" onClick={() => void chat.retryMessage(message)}>
                  Retry
                </button>
              ) : null}
            </article>
          );
        })}
        {chat.agentTyping ? (
          <p className="landing-chat-typing" role="status">
            Customer service is typing…
          </p>
        ) : null}
      </div>
      {chat.sendError || chat.imageError ? (
        <p className="landing-chat-error" role="alert">
          Message failed. Please retry.
        </p>
      ) : null}
      {chat.imageSending ? (
        <span className="landing-chat-upload" role="status">
          Uploading {Math.round((chat.imageProgress ?? 0) * 100)}%
        </span>
      ) : null}
      <form className="landing-chat-composer" onSubmit={(event) => void submit(event)}>
        <label className="landing-chat-attach">
          <span aria-hidden="true">＋</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={!conversation || chat.imageSending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) void chat.sendImage(file);
            }}
          />
        </label>
        <textarea
          aria-label="Message"
          rows={1}
          value={draft}
          disabled={!conversation || conversation.status === 'closed'}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message"
        />
        <button
          type="submit"
          disabled={
            !draft.trim() ||
            !conversation ||
            chat.sending ||
            conversation.status === 'closed'
          }
          aria-label="Send"
        >
          <SendHorizontal aria-hidden="true" />
        </button>
      </form>
    </main>
  );
}
