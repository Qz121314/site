import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  loadProductSnapshot,
  PublicContentError,
  type StorefrontBootstrap,
} from './content';
import { MarkdownContent } from './MarkdownContent';
import { ResilientImage, ResilientVideo } from './ResilientMedia';
import { sectionHref } from './routing';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';
import { SYSTEM_UI } from './system-ui';

type ResolvedCtaDestination = {
  mode: 'customer_service' | 'link';
  href: string;
  label: string | null;
};

type CtaResolveState = 'idle' | 'loading' | 'ready' | 'unavailable';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVideoMediaUrl(value: string): boolean {
  try {
    const pathname = new URL(value, window.location.origin).pathname.toLowerCase();
    return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
  } catch {
    return /\.(?:mp4|webm)(?:$|[?#])/iu.test(value);
  }
}

function isMissingProduct(error: unknown): boolean {
  return (
    error instanceof PublicContentError &&
    (error.code === 'CONTENT_NOT_PUBLISHED' ||
      error.code === 'INVALID_PRODUCT' ||
      error.code === 'INVALID_SECTION')
  );
}

function handleInternalBack(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (!canNavigateStorefrontBack()) return;
  event.preventDefault();
  navigateStorefrontBack();
}

async function resolveCtaDestination(productId: string): Promise<ResolvedCtaDestination> {
  const response = await fetch(
    `/api/public/storefront/cta/${encodeURIComponent(productId)}/resolve`,
    {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    },
  );
  const value = (await response.json().catch(() => null)) as unknown;
  const envelope = isRecord(value) ? value : null;
  if (
    !response.ok ||
    !envelope ||
    envelope.available !== true ||
    (envelope.mode !== 'customer_service' && envelope.mode !== 'link') ||
    typeof envelope.href !== 'string' ||
    !envelope.href
  ) {
    throw new Error('CTA_UNAVAILABLE');
  }
  const label =
    typeof envelope.label === 'string' && envelope.label.trim()
      ? envelope.label.trim()
      : null;
  return { mode: envelope.mode, href: envelope.href, label };
}

export function ProductDetailPage({
  bootstrap,
  productRef,
  sectionRef,
  LinkComponent = 'a',
}: {
  bootstrap: StorefrontBootstrap;
  productRef: string;
  sectionRef: string | null;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [ctaDestination, setCtaDestination] = useState<ResolvedCtaDestination | null>(
    null,
  );
  const [ctaResolveState, setCtaResolveState] = useState<CtaResolveState>('idle');
  const query = useQuery({
    queryKey: [
      'storefront-product',
      bootstrap.pointer.contentVersion,
      sectionRef,
      productRef,
    ],
    queryFn: ({ signal }) =>
      loadProductSnapshot(bootstrap, productRef, signal, sectionRef),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const product = query.data?.product ?? null;
  const media = product?.media.filter((item) => Boolean(item.url)) ?? [];
  const activeMedia = media.find((item) => item.id === activeMediaId) ?? media[0] ?? null;

  useEffect(() => {
    if (product) document.title = `${product.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, product]);

  useEffect(() => {
    setActiveMediaId(null);
    setCtaDestination(null);
    setCtaResolveState('idle');
  }, [product?.id]);

  async function handleResolveCta() {
    if (!product || ctaResolveState === 'loading' || ctaResolveState === 'unavailable') {
      return;
    }
    setCtaResolveState('loading');
    try {
      const destination = await resolveCtaDestination(product.id);
      setCtaDestination(destination);
      setCtaResolveState('ready');
    } catch {
      setCtaDestination(null);
      setCtaResolveState('unavailable');
    }
  }

  if (query.isLoading && !product) {
    return <div className="inline-loading product-detail-state">{SYSTEM_UI.loading}</div>;
  }

  if (query.error && !product) {
    const missing = isMissingProduct(query.error);
    return (
      <section
        className="product-detail-state standalone-state embedded-state"
        role="status"
      >
        <div className="state-mark">{missing ? '404' : '!'}</div>
        <h1>{missing ? SYSTEM_UI.notFound : SYSTEM_UI.unavailable}</h1>
        <div className="state-actions">
          {!missing ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => void query.refetch()}
            >
              {SYSTEM_UI.retry}
            </button>
          ) : null}
          <LinkComponent
            className={missing ? 'primary-button' : 'secondary-button'}
            href="/browse/"
            onClick={handleInternalBack}
          >
            {SYSTEM_UI.back}
          </LinkComponent>
        </div>
      </section>
    );
  }

  if (!product) return null;

  const backHref = sectionHref({ id: product.sectionId, slug: product.sectionSlug });
  const ctaLabel = ctaDestination?.label ?? product.cta?.label ?? SYSTEM_UI.continue;
  const ctaUnavailable = ctaResolveState === 'unavailable';
  const activeMediaUrl = activeMedia?.url ?? product.coverUrl;
  const activeMediaIsVideo = Boolean(
    activeMedia?.url && isVideoMediaUrl(activeMedia.url),
  );
  const activeMediaFallback = (
    <div className="detail-media-fallback" aria-hidden="true" />
  );
  const ctaAction = (
    <div className="product-detail-fixed-action">
      {ctaDestination ? (
        ctaDestination.mode === 'customer_service' ? (
          <LinkComponent className="cta-button is-ready" href={ctaDestination.href}>
            <span>{ctaLabel}</span>
            <span className="product-detail-cta-arrow" aria-hidden="true">
              →
            </span>
          </LinkComponent>
        ) : (
          <a
            className="cta-button is-ready"
            href={ctaDestination.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            <span>{ctaLabel}</span>
            <span className="product-detail-cta-arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        )
      ) : (
        <button
          className={`cta-button${ctaUnavailable ? ' is-unavailable' : ''}`}
          type="button"
          aria-busy={ctaResolveState === 'loading'}
          disabled={ctaResolveState === 'loading' || ctaUnavailable}
          onClick={() => void handleResolveCta()}
        >
          {ctaResolveState === 'loading' ? (
            <span className="product-detail-cta-spinner" aria-hidden="true" />
          ) : null}
          <span>{ctaUnavailable ? SYSTEM_UI.temporarilyUnavailable : ctaLabel}</span>
        </button>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {ctaUnavailable ? SYSTEM_UI.temporarilyUnavailable : ''}
      </span>
    </div>
  );

  return (
    <>
      <article className="product-detail-page" aria-labelledby="product-detail-title">
        <header className="product-detail-navigation">
          <LinkComponent
            className="product-detail-back"
            href={backHref}
            onClick={handleInternalBack}
          >
            {SYSTEM_UI.back}
          </LinkComponent>
        </header>

        <div className="product-detail-hero">
          <div className="detail-gallery">
            <div className="detail-media-stage" key={activeMedia?.id ?? 'cover'}>
              {activeMediaUrl ? (
                activeMediaIsVideo ? (
                  <ResilientVideo
                    aria-label={activeMedia?.altText || product.title}
                    controls
                    fallback={activeMediaFallback}
                    playsInline
                    preload="metadata"
                    src={activeMediaUrl}
                  />
                ) : (
                  <ResilientImage
                    alt={activeMedia?.altText || product.title}
                    fallback={activeMediaFallback}
                    src={activeMediaUrl}
                  />
                )
              ) : (
                activeMediaFallback
              )}
            </div>

            {media.length > 1 ? (
              <div className="detail-media-thumbnails" role="list">
                {media.map((item, index) => {
                  if (!item.url) return null;
                  const selected = item.id === activeMedia?.id;
                  const video = isVideoMediaUrl(item.url);
                  return (
                    <button
                      className={`detail-media-thumbnail${selected ? ' is-active' : ''}`}
                      type="button"
                      aria-label={item.altText || `${product.title} ${index + 1}`}
                      aria-pressed={selected}
                      key={item.id}
                      onClick={() => setActiveMediaId(item.id)}
                    >
                      {video ? (
                        <>
                          <ResilientVideo
                            aria-hidden="true"
                            fallback={<div className="detail-thumbnail-fallback" />}
                            muted
                            playsInline
                            preload="metadata"
                            src={item.url}
                          />
                          <span
                            className="detail-thumbnail-video-mark"
                            aria-hidden="true"
                          >
                            ▶
                          </span>
                        </>
                      ) : (
                        <ResilientImage
                          alt=""
                          fallback={<div className="detail-thumbnail-fallback" />}
                          loading="lazy"
                          src={item.url}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="product-detail-info">
            <section className="product-detail-summary">
              <h1 id="product-detail-title">{product.title}</h1>

              {product.category.name ? (
                <p className="product-detail-category">
                  <strong>{product.category.name}</strong>
                </p>
              ) : null}

              {product.tags.length > 0 ? (
                <div className="product-detail-tags" aria-label="Tags">
                  {product.tags.map((tag) => (
                    <span key={tag.id}>{tag.name}</span>
                  ))}
                </div>
              ) : null}
            </section>

            {product.body.trim() ? (
              <section className="product-detail-body">
                <MarkdownContent source={product.body} />
              </section>
            ) : null}
          </div>
        </div>
      </article>
      {createPortal(ctaAction, document.body)}
    </>
  );
}
