import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type AdminStatusTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const ICONS: Record<AdminStatusTone, LucideIcon> = {
  default: Circle,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

type AdminStatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: AdminStatusTone;
  showIcon?: boolean;
  children: ReactNode;
};

export function AdminStatusBadge({
  tone = 'default',
  showIcon = true,
  className,
  children,
  ...props
}: AdminStatusBadgeProps) {
  const Icon = ICONS[tone];
  return (
    <span
      className={cn('ui-status-badge', `ui-status-badge--${tone}`, className)}
      {...props}
    >
      {showIcon ? <Icon aria-hidden="true" size={13} strokeWidth={2} /> : null}
      <span>{children}</span>
    </span>
  );
}
