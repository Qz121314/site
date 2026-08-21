import { StorefrontRouteAction } from './StorefrontRouteAction';
import { SYSTEM_UI } from './system-ui';

export function ProductDetailLoadingSurface() {
  return (
    <>
      <section
        className="product-detail-loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="product-detail-loading-hero" aria-hidden="true">
          <span className="product-detail-loading-media loading-skeleton" />
          <div className="product-detail-loading-copy">
            <span className="is-title loading-skeleton" />
            <span className="is-title is-short loading-skeleton" />
            <span className="product-detail-loading-inline-action loading-skeleton" />
          </div>
        </div>
        <span className="sr-only">{SYSTEM_UI.loading}</span>
      </section>
      <StorefrontRouteAction>
        <div className="product-detail-loading-route-action" aria-hidden="true">
          <span className="loading-skeleton" />
        </div>
      </StorefrontRouteAction>
    </>
  );
}
