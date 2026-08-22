import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect } from 'react';
import type { StorefrontBootstrap } from './content';
import { ProductDetailLoadingSurface } from './ProductDetailLoadingSurface';
import { productHref } from './routing';
import { findSearchProduct, loadBrowseSearchProducts } from './search-index';
import { replaceStorefrontLocation } from './storefront-navigation-runtime';
import { SYSTEM_UI } from './system-ui';

export function LegacyProductRoute({
  bootstrap,
  productRef,
  LinkComponent,
}: {
  bootstrap: StorefrontBootstrap;
  productRef: string;
  LinkComponent: StorefrontLinkComponent;
}) {
  const productsQuery = useQuery({
    queryKey: ['storefront-browse-product-search', bootstrap.pointer.contentVersion],
    queryFn: ({ signal }) => loadBrowseSearchProducts(bootstrap, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const product = productsQuery.data
    ? findSearchProduct(productsQuery.data, productRef)
    : null;

  useEffect(() => {
    if (!product) return;
    replaceStorefrontLocation(productHref(product));
  }, [product]);

  if (productsQuery.isLoading || product) {
    return <ProductDetailLoadingSurface />;
  }

  const unavailable = productsQuery.isError;
  return (
    <section
      className="product-detail-state standalone-state embedded-state"
      role="status"
    >
      <div className="state-mark">{unavailable ? '!' : '404'}</div>
      <h1>{unavailable ? SYSTEM_UI.unavailable : SYSTEM_UI.notFound}</h1>
      <div className="state-actions">
        {unavailable ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => void productsQuery.refetch()}
          >
            {SYSTEM_UI.retry}
          </button>
        ) : null}
        <LinkComponent
          className={unavailable ? 'secondary-button' : 'primary-button'}
          href="/browse/"
        >
          {SYSTEM_UI.back}
        </LinkComponent>
      </div>
    </section>
  );
}
