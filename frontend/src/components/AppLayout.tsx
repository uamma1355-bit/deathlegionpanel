/**
 * AppLayout — Pterodactyl-style navigation bar + content area.
 * Verbatim from upstream NavigationBar.tsx.
 */

import { type ReactNode, useState, useRef, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

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

/** Nav link with Pterodactyl's cyan underline on active/hover */
function NavTab({ to, end, children }: { to: string; end?: boolean; children: ReactNode }): JSX.Element {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex h-full cursor-pointer items-center px-6 no-underline transition-all duration-150 ${
          isActive ? 'text-neutral-100' : 'text-neutral-300 hover:bg-black hover:text-neutral-100'
        }`
      }
      style={({ isActive }) =>
        isActive ? { boxShadow: 'inset 0 -2px hsl(192, 95%, 42%)' } : undefined
      }
    >
      {children}
    </NavLink>
  );
}

/** Dropdown for account menu */
function AccountDropdown(): JSX.Element {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return <></>;

  // Generate initials for avatar
  const initials = (user.username || '?').substring(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative flex h-full items-center">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-full cursor-pointer items-center px-6 text-neutral-300 transition-all duration-150 hover:bg-black hover:text-neutral-100"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-xs font-semibold text-white">
          {initials}
        </div>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 min-w-[200px] rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
          <div className="border-b border-neutral-700 px-4 py-2">
            <p className="text-sm font-medium text-neutral-100">{user.username}</p>
            <p className="truncate text-xs text-neutral-400">{user.email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/account'); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
            Account Settings
          </button>
          <button
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-neutral-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout(): JSX.Element {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* NavigationBar */}
      <div className="w-full overflow-x-auto bg-neutral-900 shadow-md">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center">
          <div id="logo" className="flex flex-1 items-center gap-2">
            <PterodactylIcon className="h-7 w-7" />
            <Link
              to="/"
              className="px-2 text-2xl font-header no-underline text-neutral-200 transition-colors duration-150 hover:text-neutral-100"
            >
              {getConfig().appName}
            </Link>
          </div>
          <div className="flex h-full items-center justify-center">
            <NavTab to="/" end>
              <svg className="mr-1.5 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />
              </svg>
              <span className="text-sm font-medium">Dashboard</span>
            </NavTab>

            {user?.admin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex h-full cursor-pointer items-center px-6 no-underline transition-all duration-150 ${
                    isActive ? 'text-neutral-100' : 'text-neutral-300 hover:bg-black hover:text-neutral-100'
                  }`
                }
                style={({ isActive }) => (isActive ? { boxShadow: 'inset 0 -2px hsl(192, 95%, 42%)' } : undefined)}
              >
                <svg className="mr-1.5 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                <span className="text-sm font-medium">Admin</span>
              </NavLink>
            )}

            <AccountDropdown />
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
          <a rel="noopener nofollow noreferrer" href="https://pterodactyl.io" target="_blank"
            className="no-underline text-neutral-500 hover:text-neutral-300">
            Pterodactyl Software
          </a>
        </p>
      </div>
    </div>
  );
}
