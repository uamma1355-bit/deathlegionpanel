/**
 * Verbatim port of pterodactyl-source/resources/scripts/components/elements/button/Button.tsx
 * Adapted: forwardRef + classnames + CSS modules (flat class names).
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

import styles from './style.module.css';

export type ButtonSize = 'small' | 'base' | 'large';
export type ButtonShape = 'default' | 'square';
export type ButtonVariant = 'default' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  shape?: ButtonShape;
  variant?: ButtonVariant;
  children: ReactNode;
}

const PrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, size = 'base', shape = 'default', variant = 'default', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={clsx(
        styles.button,
        styles.primary,
        size === 'small' && styles.buttonSmall,
        size === 'large' && styles.buttonLarge,
        shape === 'square' && styles.buttonSquare,
        variant === 'secondary' && styles.buttonSecondary,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);
PrimaryButton.displayName = 'Button';

const TextButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
  <PrimaryButton ref={ref} className={clsx(styles.text, className)} {...props} />
));
TextButton.displayName = 'Button.Text';

const DangerButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
  <PrimaryButton ref={ref} className={clsx(styles.danger, className)} {...props} />
));
DangerButton.displayName = 'Button.Danger';

const SuccessButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
  <PrimaryButton ref={ref} className={clsx(styles.success, className)} {...props} />
));
SuccessButton.displayName = 'Button.Success';

export const Button = Object.assign(PrimaryButton, {
  Text: TextButton,
  Danger: DangerButton,
  Success: SuccessButton,
  Sizes: { SMALL: 'small', BASE: 'base', LARGE: 'large' } as const,
  Shapes: { DEFAULT: 'default', ICON_SQUARE: 'square' } as const,
  Variants: { DEFAULT: 'default', SECONDARY: 'secondary' } as const,
});
