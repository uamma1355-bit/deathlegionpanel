/**
 * Verbatim port of pterodactyl-source/resources/scripts/components/elements/inputs/InputField.tsx
 * Adapted: forwardRef + classnames + CSS modules (flat class names).
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

import styles from './styles.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  description?: ReactNode;
  loose?: boolean;
  light?: boolean;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, description, loose, light, error, className, id, ...rest }, ref) => {
    const inputId = id || (rest.name ?? 'input');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            styles.textInput,
            loose && styles.textInputLoose,
            light && styles.textInputLight,
            className,
          )}
          {...rest}
        />
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
