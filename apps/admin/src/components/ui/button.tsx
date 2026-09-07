import { Slot } from '@radix-ui/react-slot';
import type { VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { buttonVariants } from './button-variants';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  asChild = false,
  className,
  variant,
  size,
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : type}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : loading || disabled}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="ui-button-spinner" aria-hidden="true" size={15} />
      ) : null}
      {children}
    </Component>
  );
}
