/**
 * ServerLayout — verbatim port of upstream ServerRouter + SubNavigation.
 *
 * Structure:
 *   NavigationBar (top, from AppLayout-equivalent — actually upstream renders
 *     NavigationBar at App level so it's shared with dashboard)
 *   SubNavigation (per-server tabs): bg-neutral-700, max-width 1200px,
 *     links py-3 px-4, hover text-neutral-100, active has inset box-shadow
 *     cyan-600
 *   Page content (Outlet)
 */

import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useServer } from '@/state/server-context';
import { Loading } from '@/components/Loading';
import { ContentContainer } from '@/components/ContentContainer';
import { PERMISSION, type Permission } from '@shared/types/permission';

interface NavItem {
  to: string;
  label: string;
  permission: Permission;
  end?: boolean;
}

export function ServerLayout(): JSX.Element {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { server, loading, error } = useServer();

  if (loading) return <Loading centered label="Loading server…" />;
  if (error || !server) {
    return (
      <ContentContainer className="my-10">
        <div className="rounded border border-red-700 bg-red-900/40 p-6 text-center">
          <h1 className="mb-2 text-xl font-medium text-red-200">Server unavailable</h1>
          <p className="text-sm text-red-300">{error ?? 'Not found'}</p>
          <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </ContentContainer>
    );
  }

  const navItems: NavItem[] = [
    { to: `/server/${id}`, label: t('server.nav.console'), permission: PERMISSION.CONTROL_CONSOLE, end: true },
    { to: `/server/${id}/files`, label: t('server.nav.files'), permission: PERMISSION.FILE_READ },
    { to: `/server/${id}/backups`, label: t('server.nav.backups'), permission: PERMISSION.BACKUP_READ },
    { to: `/server/${id}/schedules`, label: t('server.nav.schedules'), permission: PERMISSION.SCHEDULE_READ },
    { to: `/server/${id}/users`, label: t('server.nav.users'), permission: PERMISSION.USER_READ },
    { to: `/server/${id}/databases`, label: t('server.nav.databases'), permission: PERMISSION.DATABASE_READ },
    { to: `/server/${id}/network`, label: t('server.nav.network'), permission: PERMISSION.ALLOCATION_READ },
    { to: `/server/${id}/startup`, label: t('server.nav.startup'), permission: PERMISSION.STARTUP_READ },
    { to: `/server/${id}/settings`, label: t('server.nav.settings'), permission: PERMISSION.SETTINGS_VIEW },
    { to: `/server/${id}/activity`, label: t('server.nav.activity'), permission: PERMISSION.ACTIVITY_READ },
  ];

  const permissions = server.meta?.user_permissions ?? [];

  return (
    <div>
      {/* SubNavigation — verbatim from upstream */}
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
                  [
                    'whitespace-nowrap no-underline transition-all duration-150 py-3 px-4',
                    idx > 0 ? 'ml-2' : '',
                    !allowed
                      ? 'text-neutral-500 cursor-not-allowed'
                      : isActive
                        ? 'text-neutral-100'
                        : 'text-neutral-300 hover:text-neutral-100',
                  ].join(' ')
                }
                style={({ isActive }) =>
                  isActive && allowed
                    ? { boxShadow: 'inset 0 -2px hsl(192, 95%, 42%)' /* cyan-600 */ }
                    : undefined
                }
                onClick={(e) => {
                  if (!allowed) e.preventDefault();
                }}
              >
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <ContentContainer className="my-4 sm:my-10">
        <Outlet />
      </ContentContainer>
    </div>
  );
}
