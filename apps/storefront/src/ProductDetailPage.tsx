import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect } from 'react';
import {
  loadProductSnapshot,
  PublicContentError,
  type StorefrontBootstrap,
} from './content';
import { MarkdownContent } from './MarkdownContent';
import { ResilientImage, ResilientVideo } from './ResilientMedia';
import { sectionHref } from './routing';
import { useStorefrontCopy } from './storefront-copy';

function isVideoMediaUrl(value: string): boolean {
  try {
    const pathname = new URL(value, window.location.origin).pathname.toLowerCase();
    return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
  } catch {
    return /\.(?:mp4|webm)(?:$|[?#])/iu.test(value);
  }
}

function isMissingProduct(error: unknown): boolean {
  return error instanceof PublicContentError && (
    error.code === 'CONTENT_NOT_PUBLISHED'
    || error.code === 'INVALID_PRODUCT'
    || error.code === 'INVALID_SECTION'
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
  const { product: copy } = useStorefrontCopy();
  const query = useQuery({
    queryKey: ['storefront-product', bootstrap.pointer.contentVersion, sectionRef, productRef],
    queryFn: ({ signal }) => loadProductSnapshot(bootstrap, productRef, signal, sectionRef),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const product = query.data?.product ?? null;
  const media = product?.media.filter((item) => Boolean(item.url)) ?? [];

  useEffect(() => {
    if (product) document.title = `${product.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, product]);

  if (query.isLoading && !product) {
    return <div className="inline-loading product-detail-state">{copy.loading}</div>;
  }

  if (query.error && !product) {
    const missing = isMissingProduct(query.error);
    return (
      <section className="product-detail-state standalone-state embedded-state" role="status">
        <div className="state-mark">{missing ? '404' : '!'}</div>
        <h1>{missing ? 'Product not found' : 'Product unavailable'}</h1>
        <p>{missing
          ? 'This product is not part of the current published version.'
          : 'The latest published product could not be loaded. Please try again.'}</p>
        <div className="state-actions">
          {!missing ? (
            <button className="primary-button" type="button" onClick={() => void query.refetch()}>
              Try again
            </button>
          ) : null}
          <LinkComponent className={missing ? 'primary-button' : 'secondary-button'} href="/browse/">
            Back to Browse
          </LinkComponent>
        </div>
      </section>
    );
  }

  if (!product) return null;

  const backHref = sectionHref({ id: product.sectionId, slug: product.sectionSlug });
  const modeLabel = product.serviceMode === 'online' ? copy.onlineLabel : copy.offlineLabel;

  return (
    <article className="product-detail-page" aria-labelledby="product-detail-title">
      <LinkComponent className="product-detail-back" href={backHref}>
        ← {product.sectionName}
      </LinkComponent>

      <div className="product-detail-hero">
        <div className="detail-gallery" aria-label={`${product.title} media`}>
          {media.length > 0 ? media.map((item) => {
            if (!item.url) return null;
            const fallback = <div className="detail-media-fallback">{copy.mediaUnavailable}</div>;
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
          }) : product.coverUrl ? (
            <div className="detail-media-slide">
              <ResilientImage
                alt={product.title}
                fallback={<div className="detail-media-fallback">{copy.imageUnavailable}</div>}
                src={product.coverUrl}
              />
            </div>
          ) : (
            <div className="detail-media-slide">
              <div className="detail-media-fallback">{copy.noMedia}</div>
            </div>
          )}
        </div>

        <section className="product-detail-summary">
          <span className="product-detail-mode">{modeLabel}</span>
          <h1 id="product-detail-title">{product.title}</h1>

          {product.category.name ? (
            <p className="product-detail-category">
              <span>{copy.typeLabel}</span>
              <strong>{product.category.name}</strong>
            </p>
          ) : null}

          {product.tags.length > 0 ? (
            <div className="product-detail-tags" aria-label="Product tags">
              {product.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}
            </div>
          ) : null}

          {product.address ? <address className="product-detail-address">⌖ {product.address}</address> : null}

          {product.cta ? (
            <div className="product-detail-action">
              <span>{copy.contactKicker}</span>
              <p>{copy.contactHint}</p>
              <a className="cta-button" href={product.cta.path} rel="nofollow">
                {product.cta.label}
              </a>
            </div>
          ) : null}
        </section>
      </div>

      <section className="product-detail-body" aria-labelledby="product-detail-about">
        <h2 id="product-detail-about">{copy.aboutTitle}</h2>
        <MarkdownContent source={product.body} />
      </section>

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
