import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type AdminActionBarProps = HTMLAttributes<HTMLDivElement> & {
  status?: ReactNode;
  sticky?: boolean;
  children: ReactNode;
};

export function AdminActionBar({
  status,
  sticky = false,
  className,
  children,
  ...props
}: AdminActionBarProps) {
  return (
    <div
      className={cn('ui-action-bar', sticky && 'is-sticky', className)}
      {...props}
    >
      <div className="ui-action-bar-status">{status}</div>
      <div className="ui-action-bar-actions">{children}</div>
    </div>
  );
}
