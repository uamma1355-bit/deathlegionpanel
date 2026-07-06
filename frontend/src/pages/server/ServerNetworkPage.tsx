/** Network / Allocations page */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAllocations, setPrimaryAllocation, deleteAllocation } from '@/api/server';
import { useServer } from '@/state/server-context';
import { Button } from '@/components/elements/button/Button';

export function ServerNetworkPage(): JSX.Element {
  const { server } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['allocations', uuid], queryFn: () => listAllocations(uuid), enabled: !!uuid });
  const setPrimaryMut = useMutation({ mutationFn: (id: number) => setPrimaryAllocation(uuid, id), onSuccess: () => qc.invalidateQueries({ queryKey: ['allocations', uuid] }) });
  const deleteMut = useMutation({ mutationFn: (id: number) => deleteAllocation(uuid, id), onSuccess: () => qc.invalidateQueries({ queryKey: ['allocations', uuid] }) });
  const allocs = data?.data ?? [];
  return (
    <div>
      <h2 className="mb-4 text-xl font-medium text-neutral-100">Network</h2>
      {isLoading && <p className="text-neutral-400">Loading…</p>}
      {!isLoading && allocs.length === 0 && <p className="py-8 text-center text-neutral-400">No allocations assigned.</p>}
      <div className="space-y-2">
        {allocs.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded bg-neutral-700/60 p-4">
            <div>
              <p className="font-medium text-neutral-100">{a.ip}:{a.port} {a.is_default && <span className="ml-2 rounded bg-cyan-600 px-2 py-0.5 text-xs text-white">Primary</span>}</p>
              <p className="text-xs text-neutral-400">{a.notes || 'No notes'}</p>
            </div>
            <div className="flex gap-2">
              {!a.is_default && <Button.Text size="small" onClick={() => setPrimaryMut.mutate(a.id)}>Set Primary</Button.Text>}
              {!a.is_default && <Button.Danger size="small" onClick={() => { if (confirm('Delete allocation?')) deleteMut.mutate(a.id); }}>Delete</Button.Danger>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
