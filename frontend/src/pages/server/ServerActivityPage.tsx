/** Activity page */
import { useQuery } from '@tanstack/react-query';
import { getServerActivity } from '@/api/server';
import { useServer } from '@/state/server-context';

export function ServerActivityPage(): JSX.Element {
  const { server } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const { data, isLoading } = useQuery({ queryKey: ['activity', uuid], queryFn: () => getServerActivity(uuid), enabled: !!uuid });
  const activity = data as { data?: { attributes?: { event: string; ip: string; timestamp: string } }[] } | undefined;
  const logs = activity?.data ?? [];
  return (
    <div>
      <h2 className="mb-4 text-xl font-medium text-neutral-100">Activity Log</h2>
      {isLoading && <p className="text-neutral-400">Loading…</p>}
      {!isLoading && logs.length === 0 && <p className="py-8 text-center text-neutral-400">No activity recorded.</p>}
      <div className="space-y-1">
        {logs.map((log, i) => {
          const a = log.attributes;
          if (!a) return null;
          return (
            <div key={i} className="flex items-center gap-4 rounded bg-neutral-700/40 px-4 py-2 text-sm">
              <span className="text-neutral-400">{new Date(a.timestamp).toLocaleString()}</span>
              <span className="font-mono text-neutral-200">{a.event}</span>
              <span className="text-neutral-500">{a.ip}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
