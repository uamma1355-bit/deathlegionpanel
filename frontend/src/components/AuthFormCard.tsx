/**
 * Pterodactyl's auth form container — verbatim port of upstream
 * LoginFormContainer.tsx structure.
 *
 *  - title: text-3xl text-center text-neutral-100 font-medium py-4
 *  - card: md:flex w-full bg-white shadow-lg rounded-lg p-6 md:pl-0 mx-1
 *  - logo column: flex-none select-none, w-48 md:w-64 mx-auto
 *  - content column: flex-1
 */

import { type ReactNode } from 'react';

export function AuthFormCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div>
      {title && (
        <h2 className="py-4 text-center text-3xl font-medium text-neutral-100">{title}</h2>
      )}
      <div className="mx-1 flex w-full flex-col rounded-lg bg-white p-6 shadow-lg md:flex-row md:pl-0">
        <div className="mb-6 flex-none select-none self-center md:mb-0">
          {/* Pterodactyl logo SVG — simplified geometric mark */}
          <svg
            viewBox="0 0 256 256"
            className="mx-auto block w-48 md:w-64"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <circle cx="128" cy="128" r="120" fill="#0aa4cf" />
            <path
              d="M64 144 L104 104 L128 128 L168 88 L192 112 L152 152 L128 128 L88 168 Z"
              fill="#ffffff"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * Flash message render — error/success banners above the form.
 */
export function FlashMessage({
  type,
  children,
}: {
  type: 'error' | 'success' | 'warning';
  children: ReactNode;
}): JSX.Element {
  const colors = {
    error: 'bg-red-900/40 border-red-700 text-red-200',
    success: 'bg-green-900/40 border-green-700 text-green-200',
    warning: 'bg-yellow-900/40 border-yellow-700 text-yellow-200',
  };
  return (
    <div className={`mb-2 rounded border px-4 py-2 text-sm ${colors[type]}`}>{children}</div>
  );
}
