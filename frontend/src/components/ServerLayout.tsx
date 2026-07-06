/**
 * ServerLayout — Pterodactyl-style sub-navigation with icons.
 */

import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useServer } from '@/state/server-context';
import { Loading } from '@/components/Loading';
import { ContentContainer } from '@/components/AppLayout';
import { PERMISSION, type Permission } from '@shared/types/permission';

interface NavItem { to: string; label: string; icon: ReactNode; permission: Permission; end?: boolean; }

function TabIcon({ d }: { d: string }): JSX.Element {
  return (
    <svg className="mr-1.5 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function ServerLayout(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { server, loading, error } = useServer();

  if (loading) return <Loading centered label="Loading server…" />;
  if (error || !server) {
    return (
      <ContentContainer className="my-10">
        <div className="rounded border border-red-700 bg-red-900/40 p-6 text-center">
          <h1 className="mb-2 text-xl font-medium text-red-200">Server unavailable</h1>
          <p className="text-sm text-red-300">{error ?? 'Not found'}</p>
          <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:underline">← Back to dashboard</Link>
        </div>
      </ContentContainer>
    );
  }

  const navItems: NavItem[] = [
    { to: `/server/${id}`, label: 'Console', icon: <TabIcon d="M4 17l6-6-6-6M12 19h8" />, permission: PERMISSION.CONTROL_CONSOLE, end: true },
    { to: `/server/${id}/files`, label: 'Files', icon: <TabIcon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6" />, permission: PERMISSION.FILE_READ },
    { to: `/server/${id}/backups`, label: 'Backups', icon: <TabIcon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" />, permission: PERMISSION.BACKUP_READ },
    { to: `/server/${id}/schedules`, label: 'Schedules', icon: <TabIcon d="M12 6v6l4 2 M12 2a10 10 0 100 20 10 10 0 000-20z" />, permission: PERMISSION.SCHEDULE_READ },
    { to: `/server/${id}/users`, label: 'Subusers', icon: <TabIcon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" />, permission: PERMISSION.USER_READ },
    { to: `/server/${id}/databases`, label: 'Databases', icon: <TabIcon d="M12 2a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3a14 14 0 010 18 M12 3a14 14 0 000 18" />, permission: PERMISSION.DATABASE_READ },
    { to: `/server/${id}/network`, label: 'Network', icon: <TabIcon d="M5 12h14 M12 5l7 7-7 7" />, permission: PERMISSION.ALLOCATION_READ },
    { to: `/server/${id}/startup`, label: 'Startup', icon: <TabIcon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />, permission: PERMISSION.STARTUP_READ },
    { to: `/server/${id}/settings`, label: 'Settings', icon: <TabIcon d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />, permission: PERMISSION.SETTINGS_VIEW },
    { to: `/server/${id}/activity`, label: 'Activity', icon: <TabIcon d="M22 12h-4l-3 9L9 3l-3 9H2" />, permission: PERMISSION.ACTIVITY_READ },
  ];

  const permissions = server.meta?.user_permissions ?? [];

  return (
    <div>
      {/* SubNavigation */}
      <div className="w-full overflow-x-auto bg-neutral-700 shadow">
        <div className="mx-auto flex max-w-[1200px] items-center px-2 text-sm">
          {navItems.map((item, idx) => {
            const allowed = permissions.includes(item.permission);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center whitespace-nowrap py-3 px-4 no-underline transition-all duration-150 ${
                    idx > 0 ? 'ml-1' : ''
                  } ${
                    !allowed
                      ? 'cursor-not-allowed text-neutral-600'
                      : isActive
                        ? 'text-neutral-100'
                        : 'text-neutral-300 hover:text-neutral-100'
                  }`
                }
                style={({ isActive }) =>
                  isActive && allowed ? { boxShadow: 'inset 0 -2px hsl(192, 95%, 42%)' } : undefined
                }
                onClick={(e) => { if (!allowed) e.preventDefault(); }}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <ContentContainer className="my-4 sm:my-10">
        <Outlet />
      </ContentContainer>
    </div>
  );
}
