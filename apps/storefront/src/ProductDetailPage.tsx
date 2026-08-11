import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, type MouseEvent as ReactMouseEvent } from 'react';
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

  return (
    <article className="product-detail-page" aria-labelledby="product-detail-title">
      <header className="product-detail-navigation">
        <LinkComponent
          className="product-detail-back"
          href={backHref}
          onClick={handleInternalBack}
        >
          <span className="product-detail-back-icon" aria-hidden="true">
            ‹
          </span>
          <span className="product-detail-back-label">{product.sectionName}</span>
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

          {product.cta ? (
            <div className="product-detail-action">
              <a className="cta-button" href={product.cta.path} rel="nofollow">
                {product.cta.label}
              </a>
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
        <div className="product-detail-mobile-action">
          <a className="cta-button" href={product.cta.path} rel="nofollow">
            {product.cta.label}
          </a>
        </div>
      ) : null}
    </article>
  );
}
