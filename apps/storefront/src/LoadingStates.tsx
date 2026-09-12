import { SYSTEM_UI } from './system-ui';

export function StartupLoader() {
  return (
    <div className="startup-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="startup-app-shell" aria-hidden="true">
        <header className="startup-app-bar">
          <span className="startup-brand-lockup">
            <span className="startup-brand-skeleton" />
            <span className="startup-brand-copy-skeleton">
              <b />
              <i />
            </span>
          </span>
          <span className="startup-action-skeletons">
            <i />
            <i />
          </span>
        </header>
        <main className="startup-feed-skeleton">
          <div className="startup-loading-panel">
            <span className="startup-loading-line" />
          </div>
        </main>
        <nav className="startup-bottom-nav-skeleton">
          <span>
            <i />
            <b />
          </span>
          <span>
            <i />
            <b />
          </span>
          <span>
            <i />
            <b />
          </span>
          <span>
            <i />
            <b />
          </span>
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
