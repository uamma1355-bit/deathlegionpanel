/**
 * <Can permission="..."> — conditional render helper for permission-gated UI
 * elements inside a server-scoped page.
 *
 * Usage:
 *   <Can permission={PERMISSION.FILE_CREATE}>
 *     <NewFileButton />
 *   </Can>
 */

import { type ReactNode } from 'react';

import { useServerPermissions } from '@/state/server-context';
import type { Permission } from '@shared/types/permission';

export function Can({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }): JSX.Element {
  const perms = useServerPermissions();
  if (!perms || !perms.includes(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
