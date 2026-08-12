import { SYSTEM_UI } from './system-ui';

export function StartupLoader() {
  return (
    <div className="startup-loader" role="status" aria-live="polite" aria-busy="true">
      <span className="loading-halo" aria-hidden="true">
        <span />
      </span>
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
