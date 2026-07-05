/**
 * Route protection.
 *
 * - <AuthenticatedRoute> — wraps routes that require a logged-in user.
 *   While auth state is loading, renders a fullscreen loader. If
 *   unauthenticated, redirects to /auth/login?redirect=<original path>.
 *
 * - <PermissionRoute permission="..."> — used inside <ServerLayout> to
 *   gate per-server sub-pages by the user's effective permissions on
 *   that server. Reads from <ServerContext>.
 */

import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { useServerPermissions } from '@/state/server-context';
import type { Permission } from '@shared/types/permission';
import { Loading } from '@/components/Loading';

export function AuthenticatedRoute({ children }: { children: ReactNode }): JSX.Element {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading fullscreen />;
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}

export function PermissionRoute({ permission, children }: { permission: Permission; children: ReactNode }): JSX.Element {
  const perms = useServerPermissions();
  if (!perms) return <Loading fullscreen />;
  if (!perms.includes(permission)) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="mt-2 text-sm text-neutral-400">
            You do not have the <code className="text-neutral-200">{permission}</code> permission on this server.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }): JSX.Element {
  const { user, loading } = useAuth();
  if (loading) return <Loading fullscreen />;
  if (!user?.admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
