/** Startup page */
import { useQuery } from '@tanstack/react-query';
import { getStartup } from '@/api/server';
import { useServer } from '@/state/server-context';

export function ServerStartupPage(): JSX.Element {
  const { server } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const { data, isLoading } = useQuery({ queryKey: ['startup', uuid], queryFn: () => getStartup(uuid), enabled: !!uuid });
  const startup = data as { attributes?: { startup_command?: string; docker_images?: Record<string, string> } } | undefined;
  return (
    <div>
      <h2 className="mb-4 text-xl font-medium text-neutral-100">Startup</h2>
      {isLoading && <p className="text-neutral-400">Loading…</p>}
      <div className="space-y-4">
        <div className="rounded bg-neutral-700/60 p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Startup Command</p>
          <p className="font-mono text-sm text-neutral-100">{startup?.attributes?.startup_command ?? server?.attributes?.invocation ?? '—'}</p>
        </div>
        <div className="rounded bg-neutral-700/60 p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Docker Image</p>
          <p className="font-mono text-sm text-neutral-100">{server?.attributes?.docker_image ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
