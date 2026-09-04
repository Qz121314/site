import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type StorefrontIconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> & {
  children: ReactNode;
  size?: 'small' | 'medium';
  variant?: 'ghost' | 'soft' | 'primary';
};

export function StorefrontIconButton({
  children,
  className,
  size = 'medium',
  type = 'button',
  variant = 'ghost',
  ...props
}: StorefrontIconButtonProps) {
  const classes = ['storefront-icon-button', className].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      className={classes}
      data-size={size}
      data-variant={variant}
      type={type}
    >
      {children}
    </button>
  );
}
