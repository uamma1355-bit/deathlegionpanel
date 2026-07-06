/**
 * Verbatim port of pterodactyl-source/resources/scripts/components/NavigationBar.tsx
 *
 * Pterodactyl's actual top navigation bar:
 *  - bg-neutral-900 shadow-md
 *  - height 3.5rem (h-14)
 *  - max-width 1200px centered
 *  - logo: text-2xl font-header text-neutral-200 with hover text-neutral-100
 *  - nav links: text-neutral-300 px-6, hover text-neutral-100 bg-black,
 *    active/hover has inset box-shadow 0 -2px cyan-600
 */

import { type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { getConfig } from '@/config/env';
import { useAuth } from '@/auth/AuthProvider';
import { PterodactylIcon } from '@/components/PterodactylLogo';

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      {/* NavigationBar (verbatim structure from upstream) */}
      <div className="w-full overflow-x-auto bg-neutral-900 shadow-md">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center">
          <div id="logo" className="flex flex-1 items-center gap-2">
            <PterodactylIcon className="h-7 w-7" />
            <Link
              to="/"
              className="text-2xl font-header no-underline text-neutral-200 transition-colors duration-150 hover:text-neutral-100"
            >
              {getConfig().appName}
            </Link>
          </div>
          <div className="flex h-full items-center justify-center">
            {/* Dashboard */}
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                [
                  'flex h-full cursor-pointer items-center px-6 no-underline transition-all duration-150',
                  isActive ? 'text-neutral-100' : 'text-neutral-300',
                  'hover:bg-black hover:text-neutral-100',
                ].join(' ')
              }
              style={({ isActive }) =>
                isActive
                  ? { boxShadow: 'inset 0 -2px hsl(192, 95%, 42%)' /* cyan-600 */ }
                  : undefined
              }
              title={t('nav.dashboard')}
            >
              <span className="text-sm font-medium">{t('nav.dashboard')}</span>
            </NavLink>

            {/* Admin */}
            {user?.admin && (
              <a
                href="/admin"
                target="_blank"
                rel="noreferrer"
                className="flex h-full cursor-pointer items-center px-6 no-underline text-neutral-300 transition-all duration-150 hover:bg-black hover:text-neutral-100"
                title={t('nav.admin')}
              >
                <span className="text-sm font-medium">{t('nav.admin')}</span>
              </a>
            )}

            {/* Account */}
            <NavLink
              to="/account"
              className={({ isActive }) =>
                [
                  'flex h-full cursor-pointer items-center px-6 no-underline transition-all duration-150',
                  isActive ? 'text-neutral-100' : 'text-neutral-300',
                  'hover:bg-black hover:text-neutral-100',
                ].join(' ')
              }
              style={({ isActive }) =>
                isActive ? { boxShadow: 'inset 0 -2px hsl(192, 95%, 42%)' } : undefined
              }
              title={t('nav.account')}
            >
              <span className="text-sm font-medium">{user?.username ?? t('nav.account')}</span>
            </NavLink>

            {/* Sign out */}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-full cursor-pointer items-center px-6 no-underline text-neutral-300 transition-all duration-150 hover:bg-black hover:text-neutral-100"
              title={t('nav.logout')}
            >
              <span className="text-sm font-medium">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="mx-auto w-auto">
        <Outlet />
      </div>
    </div>
  );
}

/**
 * Auth layout — verbatim port of upstream auth shell.
 * Centered, dark background, white card with the Pterodactyl logo.
 */
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

export function Layout({ children }: { children: ReactNode }): JSX.Element {
  return <div className="min-h-screen">{children}</div>;
}
