import { cva } from 'class-variance-authority';

export const buttonVariants = cva('ui-button', {
  variants: {
    variant: {
      primary: 'ui-button--primary',
      secondary: 'ui-button--secondary',
      destructive: 'ui-button--destructive',
      ghost: 'ui-button--ghost',
    },
    size: {
      default: 'ui-button--default',
      compact: 'ui-button--compact',
      icon: 'ui-button--icon',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'default',
  },
});
