/**
 * Loading spinner — verbatim from upstream Spinner.tsx
 *
 * Spinner sizes: small (w-4 h-4), base (w-8 h-8), large (w-12 h-12)
 * Border 3px, rounded-full, spins 1s cubic-bezier(0.55, 0.25, 0.25, 0.7)
 */

import { clsx } from 'clsx';

export function Loading({
  fullscreen = false,
  centered = false,
  size = 'base',
  label,
}: {
  fullscreen?: boolean;
  centered?: boolean;
  size?: 'small' | 'base' | 'large';
  label?: string;
}): JSX.Element {
  const sizeClass = {
    small: 'w-4 h-4',
    base: 'w-8 h-8',
    large: 'w-12 h-12',
  }[size];

  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-3',
        fullscreen || centered ? 'h-full' : '',
        fullscreen ? 'min-h-screen' : '',
      )}
      style={fullscreen ? { background: 'hsl(209, 20%, 25%)' } : undefined}
    >
      <div
        className={`${sizeClass} rounded-full border-blue-500`}
        style={{
          borderWidth: 3,
          borderStyle: 'solid',
          borderColor: 'rgba(0, 0, 0, 0.1)',
          borderTopColor: 'hsl(217, 91%, 60%)', /* blue-500 */
          animation: 'spin 1s cubic-bezier(0.55, 0.25, 0.25, 0.7) infinite',
        }}
      />
      {label && <span className="text-xs text-neutral-400">{label}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
