import { Search } from 'lucide-react';
import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Input } from './input';

type AdminToolbarProps = HTMLAttributes<HTMLDivElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
};

export function AdminToolbar({
  leading,
  trailing,
  children,
  className,
  ...props
}: AdminToolbarProps) {
  return (
    <div className={cn('ui-management-toolbar', className)} {...props}>
      {leading ? <div className="ui-management-toolbar-leading">{leading}</div> : null}
      {children ? <div className="ui-management-toolbar-controls">{children}</div> : null}
      {trailing ? <div className="ui-management-toolbar-trailing">{trailing}</div> : null}
    </div>
  );
}

type AdminSearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export function AdminSearchField({ label, className, ...props }: AdminSearchFieldProps) {
  return (
    <label className={cn('ui-management-search', className)}>
      <Search aria-hidden="true" size={16} />
      <span className="sr-only">{label}</span>
      <Input type="search" {...props} />
    </label>
  );
}

type AdminSelectionBarProps = HTMLAttributes<HTMLDivElement> & {
  count: number;
  noun: string;
  children: ReactNode;
};

export function AdminSelectionBar({
  count,
  noun,
  className,
  children,
  ...props
}: AdminSelectionBarProps) {
  return (
    <div
      className={cn('ui-management-selection-bar', className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <strong>
        已选择 {count} 个{noun}
      </strong>
      <div className="ui-management-selection-actions">{children}</div>
    </div>
  );
}
