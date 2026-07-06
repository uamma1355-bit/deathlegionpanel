/**
 * ServerLayout — verbatim Pterodactyl SubNavigation.
 * bg-neutral-700 tabs with cyan-600 underline on active.
 */

import { Link, NavLink, Outlet, useParams } from 'react-router-dom';

import { useServer } from '@/state/server-context';
import { Loading } from '@/components/Loading';
import { ContentContainer } from '@/components/AppLayout';
import { PERMISSION, type Permission } from '@shared/types/permission';

interface NavItem { to: string; label: string; permission: Permission; end?: boolean; }

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
          <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:underline">Back to dashboard</Link>
        </div>
      </ContentContainer>
    );
  }

  const navItems: NavItem[] = [
    { to: `/server/${id}`, label: 'Console', permission: PERMISSION.CONTROL_CONSOLE, end: true },
    { to: `/server/${id}/files`, label: 'Files', permission: PERMISSION.FILE_READ },
    { to: `/server/${id}/backups`, label: 'Backups', permission: PERMISSION.BACKUP_READ },
    { to: `/server/${id}/schedules`, label: 'Schedules', permission: PERMISSION.SCHEDULE_READ },
    { to: `/server/${id}/users`, label: 'Subusers', permission: PERMISSION.USER_READ },
    { to: `/server/${id}/databases`, label: 'Databases', permission: PERMISSION.DATABASE_READ },
    { to: `/server/${id}/network`, label: 'Network', permission: PERMISSION.ALLOCATION_READ },
    { to: `/server/${id}/startup`, label: 'Startup', permission: PERMISSION.STARTUP_READ },
    { to: `/server/${id}/settings`, label: 'Settings', permission: PERMISSION.SETTINGS_VIEW },
    { to: `/server/${id}/activity`, label: 'Activity', permission: PERMISSION.ACTIVITY_READ },
  ];

  const permissions = server.meta?.user_permissions ?? [];

  return (
    <div>
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
                  `whitespace-nowrap no-underline transition-all duration-150 py-3 px-4 ${
                    idx > 0 ? 'ml-2' : ''
                  } ${
                    !allowed
                      ? 'text-neutral-500 cursor-not-allowed'
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
                {item.label}
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
