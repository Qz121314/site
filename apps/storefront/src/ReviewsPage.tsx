import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import type { StorefrontBootstrap } from './content';
import { loadProductSnapshot, loadSectionSnapshot } from './content-route';
import { MarkdownContent } from './MarkdownContent';
import { NotFoundPage } from './NotFoundPage';
import { ProductDetailLoadingSurface } from './ProductDetailLoadingSurface';
import { ResilientImage, ResilientVideo } from './ResilientMedia';
import { SYSTEM_UI } from './system-ui';
import './reviews-content-ui.css';

function isVideoMedia(url: string): boolean {
  try {
    return /\.(?:mp4|webm)$/iu.test(new URL(url, window.location.origin).pathname);
  } catch {
    return false;
  }
}

export function ReviewsPage({
  bootstrap,
  LinkComponent,
}: {
  bootstrap: StorefrontBootstrap;
  LinkComponent: StorefrontLinkComponent;
}) {
  const section = bootstrap.home.allSections.find((item) => item.slug === 'reviews');
  const sectionQuery = useQuery({
    queryKey: ['storefront-section', bootstrap.pointer.contentVersion, section?.id],
    enabled: Boolean(section),
    queryFn: ({ signal }) => loadSectionSnapshot(bootstrap, section!.id, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const summary = sectionQuery.data?.products.find(
    (item) => item.id === sectionQuery.data?.directProductId,
  );
  const sectionRef = section?.slug || section?.id || '';
  const productRef = summary?.slug || summary?.id || '';
  const productQuery = useQuery({
    queryKey: [
      'storefront-product',
      bootstrap.pointer.contentVersion,
      sectionRef,
      productRef,
    ],
    enabled: Boolean(section && summary),
    queryFn: ({ signal }) =>
      loadProductSnapshot(bootstrap, productRef, signal, sectionRef),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const product = productQuery.data?.product;

  useEffect(() => {
    if (product) document.title = `${product.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, product]);

  if (!section || (!sectionQuery.isPending && !sectionQuery.error && !summary)) {
    return (
      <NotFoundPage siteName={bootstrap.site.site.name} LinkComponent={LinkComponent} />
    );
  }
  const queryError = sectionQuery.error
    ? sectionQuery
    : productQuery.error
      ? productQuery
      : null;
  if (queryError) {
    return (
      <section className="standalone-state embedded-state" role="status">
        <div className="state-mark" aria-hidden="true">
          <CircleAlert />
        </div>
        <h1>{SYSTEM_UI.unavailable}</h1>
        <button
          className="primary-button"
          type="button"
          onClick={() => void queryError.refetch()}
        >
          {SYSTEM_UI.retry}
        </button>
      </section>
    );
  }
  if (!product) return <ProductDetailLoadingSurface />;

  return (
    <article className="reviews-content-page" aria-labelledby="reviews-content-title">
      <h1 id="reviews-content-title">{product.title}</h1>
      {product.media.some((item) => item.url) ? (
        <div className="reviews-content-media">
          {product.media.map((item) => {
            if (!item.url) return null;
            return isVideoMedia(item.url) ? (
              <ResilientVideo
                key={item.id}
                aria-label={item.altText || product.title}
                controls
                fallback={<div className="reviews-content-media-fallback" />}
                playsInline
                preload="none"
                src={item.url}
              />
            ) : (
              <ResilientImage
                key={item.id}
                alt={item.altText || product.title}
                fallback={<div className="reviews-content-media-fallback" />}
                loading="lazy"
                src={item.url}
              />
            );
          })}
        </div>
      ) : null}
      {product.body.trim() ? (
        <div className="reviews-content-body">
          <MarkdownContent source={product.body} />
        </div>
      ) : null}
    </article>
  );
}
