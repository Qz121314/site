import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { CircleAlert } from 'lucide-react';
import type { StorefrontBootstrap } from './content';
import { loadSectionSnapshot } from './content-route';
import { NotFoundPage } from './NotFoundPage';
import { ProductDetailLoadingSurface } from './ProductDetailLoadingSurface';
import { ProductDetailPage } from './ProductDetailPage';
import { SYSTEM_UI } from './system-ui';

export function ReviewsPage({
  bootstrap,
  LinkComponent,
}: {
  bootstrap: StorefrontBootstrap;
  LinkComponent: StorefrontLinkComponent;
}) {
  const section = bootstrap.home.allSections.find((item) => item.slug === 'reviews');
  const query = useQuery({
    queryKey: ['storefront-section', bootstrap.pointer.contentVersion, section?.id],
    enabled: Boolean(section),
    queryFn: ({ signal }) => loadSectionSnapshot(bootstrap, section!.id, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const product = query.data?.products.find(
    (item) => item.id === query.data?.directProductId,
  );

  if (!section || (!query.isLoading && !query.error && !product)) {
    return (
      <NotFoundPage siteName={bootstrap.site.site.name} LinkComponent={LinkComponent} />
    );
  }
  if (query.error) {
    return (
      <section className="standalone-state embedded-state" role="status">
        <div className="state-mark" aria-hidden="true">
          <CircleAlert />
        </div>
        <h1>{SYSTEM_UI.unavailable}</h1>
        <button
          className="primary-button"
          type="button"
          onClick={() => void query.refetch()}
        >
          {SYSTEM_UI.retry}
        </button>
      </section>
    );
  }
  if (!product) return <ProductDetailLoadingSurface />;

  return (
    <ProductDetailPage
      bootstrap={bootstrap}
      productRef={product.slug || product.id}
      sectionRef={section.slug || section.id}
      LinkComponent={LinkComponent}
    />
  );
}
