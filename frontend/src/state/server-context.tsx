/**
 * Server context — holds the current server (fetched once on mount of
 * <ServerLayout>) and exposes the user's effective permissions on it.
 *
 * Used by <PermissionRoute> and <Can>.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { getServer } from '@/api/server/getServer';
import type { ServerResponse } from '@shared/types/server';

interface ServerContextValue {
  server: ServerResponse | null;
  loading: boolean;
  error: string | null;
  permissions: string[] | null;
  isOwner: boolean;
  refresh: () => Promise<void>;
}

const ServerContext = createContext<ServerContextValue | null>(null);

export function ServerProvider({ children }: { children: ReactNode }): JSX.Element {
  const params = useParams<{ id: string }>();
  const serverId = params.id ?? '';
  const [server, setServer] = useState<ServerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useMemo(
    () => async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const resp = await getServer(serverId);
        setServer(resp);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load server');
      } finally {
        setLoading(false);
      }
    },
    [serverId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ServerContextValue>(
    () => ({
      server,
      loading,
      error,
      permissions: server?.meta?.user_permissions ?? null,
      isOwner: server?.meta?.is_server_owner ?? false,
      refresh,
    }),
    [server, loading, error, refresh],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerContextValue {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used inside <ServerProvider>');
  return ctx;
}

export function useServerPermissions(): string[] | null {
  return useServer().permissions;
}
