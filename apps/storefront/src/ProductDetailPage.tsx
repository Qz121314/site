import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  loadProductSnapshot,
  PublicContentError,
  type StorefrontBootstrap,
} from './content';
import { loadPublicCta, resolveCustomerServiceCta } from './cta';
import { MarkdownContent } from './MarkdownContent';
import { ProductDetailLoadingSurface } from './ProductDetailLoadingSurface';
import { ResilientImage, ResilientVideo } from './ResilientMedia';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';
import { pushStorefrontLocation } from './storefront-navigation-runtime';
import { StorefrontRouteAction } from './StorefrontRouteAction';
import { SYSTEM_UI } from './system-ui';
import './product-detail-ui.css';
import './product-detail-content-flow.css';
import '@site/storefront-ui/product-detail-theme-contract.css';

function isVideoMediaUrl(value: string): boolean {
  try {
    const pathname = new URL(value, window.location.origin).pathname.toLowerCase();
    return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
  } catch {
    return /\.(?:mp4|webm)(?:$|[?#])/iu.test(value);
  }
}

function hasMediaUrl<T extends { url: string | null }>(
  item: T,
): item is T & { url: string } {
  return Boolean(item.url);
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

function CtaArrow() {
  return (
    <span className="product-detail-cta-arrow" aria-hidden="true">
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="m8 5 5 5-5 5" />
      </svg>
    </span>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21s6-5.18 6-11a6 6 0 1 0-12 0c0 5.82 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.15" />
    </svg>
  );
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
  const queryClient = useQueryClient();
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [mobileMediaIndex, setMobileMediaIndex] = useState(0);
  const [ctaNavigating, setCtaNavigating] = useState(false);
  const mobileMediaTrackRef = useRef<HTMLDivElement | null>(null);
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
  const ctaQuery = useQuery({
    queryKey: ['storefront-product-cta', product?.id],
    enabled: Boolean(product?.id),
    queryFn: ({ signal }) => loadPublicCta(product!.id, signal),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const media = product?.media.filter(hasMediaUrl) ?? [];
  const activeMedia = media.find((item) => item.id === activeMediaId) ?? media[0] ?? null;

  useEffect(() => {
    if (product) document.title = `${product.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, product]);

  useEffect(() => {
    setActiveMediaId(null);
    setMobileMediaIndex(0);
    setCtaNavigating(false);
    mobileMediaTrackRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  }, [product?.id]);

  if (query.isLoading && !product) {
    return <ProductDetailLoadingSurface />;
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

  const activeMediaUrl = activeMedia?.url ?? product.coverUrl;
  const activeMediaIsVideo = Boolean(
    activeMedia?.url && isVideoMediaUrl(activeMedia.url),
  );
  const mobileGalleryItems =
    media.length > 0
      ? media.map((item) => ({
          id: item.id,
          url: item.url,
          altText: item.altText || product.title,
        }))
      : product.coverUrl
        ? [
            {
              id: 'cover',
              url: product.coverUrl,
              altText: product.title,
            },
          ]
        : [];
  const activeMediaFallback = (
    <div className="detail-media-fallback" aria-hidden="true" />
  );
  const address = product.address?.trim() ?? '';
  const body = product.body.trim();
  const bodyIsAddress = Boolean(address && body && body === address);

  function handleMobileGalleryScroll() {
    const track = mobileMediaTrackRef.current;
    if (!track || track.clientWidth <= 0 || mobileGalleryItems.length <= 1) return;
    const nextIndex = Math.max(
      0,
      Math.min(
        mobileGalleryItems.length - 1,
        Math.round(track.scrollLeft / track.clientWidth),
      ),
    );
    setMobileMediaIndex((current) => (current === nextIndex ? current : nextIndex));
  }

  async function handleCtaClick() {
    if (ctaQuery.isFetching || ctaNavigating) return;
    const cta = ctaQuery.data ?? (await ctaQuery.refetch()).data;
    if (!cta) return;
    if (cta.mode === 'customer_service') {
      setCtaNavigating(true);
      try {
        const path = await resolveCustomerServiceCta(cta.path);
        const target = new URL(path, window.location.href);
        const composeProductId = target.searchParams.get('productId');
        const composeSectionId = target.searchParams.get('sectionId');
        if (
          query.data &&
          composeProductId === product.id &&
          composeSectionId === product.sectionId
        ) {
          queryClient.setQueryData(
            ['support-compose-product', composeSectionId, composeProductId],
            query.data,
          );
        }
        pushStorefrontLocation(path);
      } catch {
        window.location.assign(cta.path);
      }
      return;
    }
    window.location.assign(cta.path);
  }

  const ctaLoading = ctaQuery.isFetching || ctaQuery.isPending || ctaNavigating;
  const ctaMissing = !ctaLoading && !ctaQuery.error && ctaQuery.data === null;
  const ctaFailed = !ctaLoading && Boolean(ctaQuery.error);

  function renderCtaButton() {
    const cta = ctaQuery.data;
    const stateClass = ctaMissing
      ? ' is-unavailable'
      : ctaFailed
        ? ' is-retry'
        : cta
          ? ' is-ready'
          : ' is-loading';

    return (
      <button
        className={`cta-button${stateClass}`}
        type="button"
        aria-busy={ctaLoading || undefined}
        disabled={ctaLoading || ctaMissing}
        onClick={() => void handleCtaClick()}
      >
        {ctaLoading ? (
          <>
            <span className="product-detail-cta-spinner" aria-hidden="true" />
            <span className="sr-only">{SYSTEM_UI.loading}</span>
          </>
        ) : ctaMissing ? (
          <span>{SYSTEM_UI.unavailable}</span>
        ) : ctaFailed ? (
          <>
            <span>{SYSTEM_UI.retry}</span>
            <CtaArrow />
          </>
        ) : cta ? (
          <>
            <span className="product-detail-cta-label">{cta.label}</span>
            <CtaArrow />
          </>
        ) : null}
      </button>
    );
  }

  function renderMobileMedia(
    item: { id: string; url: string; altText: string },
    eager = false,
  ) {
    const video = isVideoMediaUrl(item.url);
    if (video) {
      return (
        <ResilientVideo
          aria-label={item.altText}
          controls
          fallback={activeMediaFallback}
          playsInline
          preload="none"
          src={item.url}
        />
      );
    }

    return (
      <ResilientImage
        alt={item.altText}
        fallback={activeMediaFallback}
        fetchPriority={eager ? 'high' : 'auto'}
        loading={eager ? 'eager' : 'lazy'}
        src={item.url}
      />
    );
  }

  return (
    <>
      <article className="product-detail-page" aria-labelledby="product-detail-title">
        <div className="product-detail-hero">
          <div className="detail-gallery">
            <div
              className="detail-mobile-gallery"
              role="region"
              aria-roledescription="carousel"
              aria-label={product.title}
            >
              <div className="detail-mobile-media-stage">
                {mobileGalleryItems.length > 0 ? (
                  <div
                    className="detail-mobile-media-track"
                    ref={mobileMediaTrackRef}
                    onScroll={handleMobileGalleryScroll}
                    tabIndex={mobileGalleryItems.length > 1 ? 0 : undefined}
                  >
                    {mobileGalleryItems.map((item, index) => (
                      <div
                        className="detail-mobile-media-item"
                        role="group"
                        aria-label={`${index + 1} / ${mobileGalleryItems.length}`}
                        key={item.id}
                      >
                        {renderMobileMedia(item, index === 0)}
                      </div>
                    ))}
                  </div>
                ) : (
                  activeMediaFallback
                )}
                {mobileGalleryItems.length > 1 ? (
                  <span className="detail-mobile-media-count" aria-hidden="true">
                    {mobileMediaIndex + 1} / {mobileGalleryItems.length}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="detail-desktop-gallery">
              <div className="detail-media-stage" key={activeMedia?.id ?? 'cover'}>
                {activeMediaUrl ? (
                  activeMediaIsVideo ? (
                    <ResilientVideo
                      aria-label={activeMedia?.altText || product.title}
                      controls
                      fallback={activeMediaFallback}
                      playsInline
                      preload="none"
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
                              preload="none"
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
          </div>

          <div className="product-detail-info">
            <section className="product-detail-summary">
              <h1 id="product-detail-title">{product.title}</h1>
              {address ? (
                <div className="product-detail-address">
                  <LocationIcon />
                  <span>{address}</span>
                </div>
              ) : null}
            </section>

            <div className="product-detail-inline-action">{renderCtaButton()}</div>
          </div>
        </div>

        {body && !bodyIsAddress ? (
          <section className="product-detail-body">
            <MarkdownContent source={product.body} />
          </section>
        ) : null}
      </article>
      <StorefrontRouteAction>
        <div className="product-detail-route-action">{renderCtaButton()}</div>
      </StorefrontRouteAction>
    </>
  );
}
