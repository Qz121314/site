import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  loadProductSnapshot,
  PublicContentError,
  type StorefrontBootstrap,
} from './content';
import { loadPublicCta } from './cta';
import { MarkdownContent } from './MarkdownContent';
import { ResilientImage, ResilientVideo } from './ResilientMedia';
import { sectionHref } from './routing';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';
import { SYSTEM_UI } from './system-ui';
import './product-detail-ui.css';
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

function navigateInternalCta(path: string) {
  window.location.assign(path);
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
  const [mobileMediaIndex, setMobileMediaIndex] = useState(0);
  const [ctaAttempted, setCtaAttempted] = useState(false);
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
    enabled: false,
    queryFn: ({ signal }) => loadPublicCta(product!.id, signal),
  });
  const media = product?.media.filter(hasMediaUrl) ?? [];
  const activeMedia = media.find((item) => item.id === activeMediaId) ?? media[0] ?? null;

  useEffect(() => {
    if (product) document.title = `${product.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, product]);

  useEffect(() => {
    setActiveMediaId(null);
    setMobileMediaIndex(0);
    setCtaAttempted(false);
  }, [product?.id]);

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

  function selectMobileMedia(index: number) {
    const item = mobileGalleryItems[index];
    if (!item) return;
    setMobileMediaIndex(index);
    setActiveMediaId(item.id === 'cover' ? null : item.id);
    const track = mobileMediaTrackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.clientWidth * index });
  }

  async function handleCtaClick() {
    if (ctaQuery.isFetching) return;
    setCtaAttempted(true);
    const result = await ctaQuery.refetch();
    const cta = result.data;
    if (!cta) return;
    if (cta.mode === 'customer_service') {
      navigateInternalCta(cta.path);
      return;
    }
    window.location.assign(cta.path);
  }

  const ctaUnavailable =
    ctaAttempted &&
    !ctaQuery.isFetching &&
    (Boolean(ctaQuery.error) || ctaQuery.data === null);
  const ctaAction = (
    <div className="product-detail-fixed-action">
      <button
        className={`cta-button${ctaUnavailable ? ' is-unavailable' : ' is-ready'}`}
        type="button"
        aria-busy={ctaQuery.isFetching || undefined}
        disabled={ctaQuery.isFetching || ctaUnavailable}
        onClick={() => void handleCtaClick()}
      >
        {ctaQuery.isFetching ? (
          <>
            <span className="product-detail-cta-spinner" aria-hidden="true" />
            <span className="sr-only">{SYSTEM_UI.loading}</span>
          </>
        ) : ctaUnavailable ? (
          <span>
            {ctaQuery.error ? SYSTEM_UI.temporarilyUnavailable : SYSTEM_UI.unavailable}
          </span>
        ) : (
          <>
            <span>{SYSTEM_UI.continue}</span>
            <CtaArrow />
          </>
        )}
      </button>
    </div>
  );

  return (
    <>
      <article className="product-detail-page" aria-labelledby="product-detail-title">
        <header className="product-detail-navigation">
          <LinkComponent
            aria-label={SYSTEM_UI.back}
            className="product-detail-back"
            href={backHref}
            onClick={handleInternalBack}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="m12.5 4.5-5.5 5.5 5.5 5.5" />
            </svg>
            <span className="product-detail-back-label">{SYSTEM_UI.back}</span>
          </LinkComponent>
        </header>

        <div className="product-detail-hero">
          <div className="detail-gallery">
            <div className="detail-mobile-gallery">
              <div className="detail-mobile-media-stage">
                <div
                  className="detail-mobile-media-track"
                  ref={mobileMediaTrackRef}
                  onScroll={(event) => {
                    const width = event.currentTarget.clientWidth;
                    if (!width) return;
                    const nextIndex = Math.max(
                      0,
                      Math.min(
                        mobileGalleryItems.length - 1,
                        Math.round(event.currentTarget.scrollLeft / width),
                      ),
                    );
                    if (nextIndex !== mobileMediaIndex) {
                      setMobileMediaIndex(nextIndex);
                      const item = mobileGalleryItems[nextIndex];
                      if (item) setActiveMediaId(item.id === 'cover' ? null : item.id);
                    }
                  }}
                >
                  {mobileGalleryItems.length > 0
                    ? mobileGalleryItems.map((item) => {
                        const video = isVideoMediaUrl(item.url);
                        return (
                          <div className="detail-mobile-media-item" key={item.id}>
                            {video ? (
                              <ResilientVideo
                                aria-label={item.altText}
                                controls
                                fallback={activeMediaFallback}
                                playsInline
                                preload="metadata"
                                src={item.url}
                              />
                            ) : (
                              <ResilientImage
                                alt={item.altText}
                                fallback={activeMediaFallback}
                                src={item.url}
                              />
                            )}
                          </div>
                        );
                      })
                    : activeMediaFallback}
                </div>
                {mobileGalleryItems.length > 1 ? (
                  <span className="detail-mobile-media-count" aria-hidden="true">
                    {mobileMediaIndex + 1} / {mobileGalleryItems.length}
                  </span>
                ) : null}
              </div>

              {mobileGalleryItems.length > 1 ? (
                <div className="detail-mobile-thumbnails" role="list">
                  {mobileGalleryItems.map((item, index) => {
                    const selected = index === mobileMediaIndex;
                    const video = isVideoMediaUrl(item.url);
                    return (
                      <button
                        className={`detail-media-thumbnail${selected ? ' is-active' : ''}`}
                        type="button"
                        aria-label={item.altText || `${product.title} ${index + 1}`}
                        aria-pressed={selected}
                        key={item.id}
                        onClick={() => selectMobileMedia(index)}
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

            <div className="detail-desktop-gallery">
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
          </div>

          <div className="product-detail-info">
            <section className="product-detail-summary">
              <h1 id="product-detail-title">{product.title}</h1>

              {product.tags.length > 0 ? (
                <div className="product-detail-tags" aria-label="Tags">
                  {product.tags.map((tag) => (
                    <span key={tag.id}>{tag.name}</span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>

        {product.body.trim() ? (
          <section className="product-detail-body">
            <MarkdownContent source={product.body} />
          </section>
        ) : null}
      </article>
      {createPortal(ctaAction, document.body)}
    </>
  );
}
