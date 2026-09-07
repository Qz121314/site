import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './button';

type AdminSegmentedControlProps = HTMLAttributes<HTMLDivElement> & {
  ariaLabel: string;
  children: ReactNode;
};

export function AdminSegmentedControl({
  ariaLabel,
  className,
  children,
  ...props
}: AdminSegmentedControlProps) {
  return (
    <div
      className={cn('ui-segmented-control', className)}
      role="group"
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </div>
  );
}

type AdminSegmentedItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean;
  current?: boolean;
};

export function AdminSegmentedItem({
  selected,
  current = false,
  className,
  children,
  ...props
}: AdminSegmentedItemProps) {
  return (
    <Button
      className={cn('ui-segmented-item', selected && 'is-selected', className)}
      variant="ghost"
      size="compact"
      aria-pressed={selected}
      aria-current={current ? 'page' : undefined}
      {...props}
    >
      {children}
    </Button>
  );
}
