import type { HTMLAttributes } from 'react';

export type LoadingHaloSize = 'small' | 'medium' | 'large';

type LoadingHaloProps = {
  size?: LoadingHaloSize;
  label?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>;

export function LoadingHalo({
  size = 'medium',
  label,
  className = '',
  ...props
}: LoadingHaloProps) {
  const classes = `loading-halo is-${size}${className ? ` ${className}` : ''}`;
  return (
    <span
      {...props}
      className={classes}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function LoadingHaloOverlay({
  label,
  className = '',
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`loading-halo-overlay${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <LoadingHalo size="large" />
    </div>
  );
}
