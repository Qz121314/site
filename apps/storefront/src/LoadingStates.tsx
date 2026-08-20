import { SYSTEM_UI } from './system-ui';

export function StartupLoader() {
  return (
    <div className="startup-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="startup-app-shell" aria-hidden="true">
        <header className="startup-app-bar">
          <span className="startup-brand-skeleton" />
        </header>
        <main className="startup-feed-skeleton">
          <span className="startup-hero-skeleton" />
          <div className="startup-shortcut-skeletons">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="startup-section-heading-skeleton">
            <span />
            <i />
          </div>
          <div className="startup-product-rail-skeleton">
            {Array.from({ length: 3 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        </main>
        <nav className="startup-bottom-nav-skeleton">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} />
          ))}
        </nav>
      </div>
      <span className="sr-only">{SYSTEM_UI.loading}</span>
    </div>
  );
}

export function RouteProgress() {
  return (
    <div className="route-progress" role="status" aria-live="polite" aria-busy="true">
      <span aria-hidden="true" />
      <span className="sr-only">{SYSTEM_UI.loading}</span>
    </div>
  );
}

export function SquareSkeletonGrid({
  count = 4,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`loading-square-grid${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <span className="loading-skeleton loading-square" key={index} />
      ))}
    </div>
  );
}
