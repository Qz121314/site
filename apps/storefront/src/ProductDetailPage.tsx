import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
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
};

type CtaResolveState = 'idle' | 'loading' | 'ready' | 'error';

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
  return { mode: envelope.mode, href: envelope.href };
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

  useEffect(() => {
    if (product) document.title = `${product.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, product]);

  useEffect(() => {
    setCtaDestination(null);
    setCtaResolveState('idle');
  }, [product?.id]);

  async function handleResolveCta() {
    if (!product?.cta || ctaResolveState === 'loading') return;
    setCtaResolveState('loading');
    try {
      const destination = await resolveCtaDestination(product.id);
      setCtaDestination(destination);
      setCtaResolveState('ready');
    } catch {
      setCtaDestination(null);
      setCtaResolveState('error');
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
  const ctaLabel = product.cta?.label ?? '';

  return (
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
          {media.length > 0 ? (
            media.map((item) => {
              if (!item.url) return null;
              const fallback = (
                <div className="detail-media-fallback" aria-hidden="true" />
              );
              return (
                <div className="detail-media-slide" key={item.id}>
                  {isVideoMediaUrl(item.url) ? (
                    <ResilientVideo
                      aria-label={item.altText || product.title}
                      controls
                      fallback={fallback}
                      playsInline
                      preload="metadata"
                      src={item.url}
                    />
                  ) : (
                    <ResilientImage
                      alt={item.altText || product.title}
                      fallback={fallback}
                      src={item.url}
                    />
                  )}
                </div>
              );
            })
          ) : product.coverUrl ? (
            <div className="detail-media-slide">
              <ResilientImage
                alt={product.title}
                fallback={<div className="detail-media-fallback" aria-hidden="true" />}
                src={product.coverUrl}
              />
            </div>
          ) : (
            <div className="detail-media-slide">
              <div className="detail-media-fallback" aria-hidden="true" />
            </div>
          )}
        </div>

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
      </div>

      {product.body.trim() ? (
        <section className="product-detail-body">
          <MarkdownContent source={product.body} />
        </section>
      ) : null}

      {product.cta ? (
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
              className="cta-button"
              type="button"
              aria-busy={ctaResolveState === 'loading'}
              disabled={ctaResolveState === 'loading'}
              onClick={() => void handleResolveCta()}
            >
              {ctaResolveState === 'loading' ? (
                <span className="product-detail-cta-spinner" aria-hidden="true" />
              ) : null}
              <span>{ctaLabel}</span>
            </button>
          )}
          <span className="sr-only" role="status" aria-live="polite">
            {ctaResolveState === 'error' ? SYSTEM_UI.unavailable : ''}
          </span>
        </div>
      ) : null}
    </article>
  );
}
