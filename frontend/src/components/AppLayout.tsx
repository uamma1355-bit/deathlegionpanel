/**
 * Verbatim port of Pterodactyl's NavigationBar.tsx
 * + ContentContainer (max-w-1200px centered)
 * + AppLayout (user-facing layout with nav bar)
 * + AuthLayout (login/2FA/forgot password layout)
 */

import { type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { getConfig } from '@/config/env';
import { useAuth } from '@/auth/AuthProvider';
import { PterodactylIcon } from '@/components/PterodactylLogo';

export function ContentContainer({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div className={`mx-4 xl:mx-auto ${className}`} style={{ maxWidth: 1200 }}>
      {children}
    </div>
  );
}

export function AppLayout(): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      {/* NavigationBar — verbatim from upstream */}
      <div className="w-full overflow-x-auto bg-neutral-900 shadow-md">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center">
          <div id="logo" className="flex flex-1 items-center gap-2">
            <PterodactylIcon className="h-7 w-7" />
            <Link
              to="/"
              className="px-4 text-2xl font-header no-underline text-neutral-200 transition-colors duration-150 hover:text-neutral-100"
            >
              {getConfig().appName}
            </Link>
          </div>
          <div className="flex h-full items-center justify-center">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex h-full cursor-pointer items-center px-6 no-underline transition-all duration-150 ${
                  isActive ? 'text-neutral-100' : 'text-neutral-300 hover:bg-black hover:text-neutral-100'
                }`
              }
              style={({ isActive }) => (isActive ? { boxShadow: 'inset 0 -2px hsl(192, 95%, 42%)' } : undefined)}
            >
              <span className="text-sm font-medium">Dashboard</span>
            </NavLink>

            {user?.admin && (
              <NavLink
                to="/account"
                className={({ isActive }) =>
                  `flex h-full cursor-pointer items-center px-6 no-underline transition-all duration-150 ${
                    isActive ? 'text-neutral-100' : 'text-neutral-300 hover:bg-black hover:text-neutral-100'
                  }`
                }
                style={({ isActive }) => (isActive ? { boxShadow: 'inset 0 -2px hsl(192, 95%, 42%)' } : undefined)}
              >
                <span className="text-sm font-medium">{user.username}</span>
              </NavLink>
            )}

            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-full cursor-pointer items-center px-6 no-underline text-neutral-300 transition-all duration-150 hover:bg-black hover:text-neutral-100"
            >
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-auto">
        <Outlet />
      </div>
    </div>
  );
}

export function AuthLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full" style={{ maxWidth: 700 }}>
        <Outlet />
        <p className="mt-4 text-center text-xs text-neutral-500">
          &copy; 2015 - {new Date().getFullYear()}&nbsp;
          <a
            rel="noopener nofollow noreferrer"
            href="https://pterodactyl.io"
            target="_blank"
            className="no-underline text-neutral-500 hover:text-neutral-300"
          >
            Pterodactyl Software
          </a>
        </p>
      </div>
    </div>
  );
}
