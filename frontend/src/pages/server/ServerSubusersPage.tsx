/** Subusers page */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSubusers, deleteSubuser } from '@/api/server';
import { useServer } from '@/state/server-context';
import { Button } from '@/components/elements/button/Button';

export function ServerSubusersPage(): JSX.Element {
  const { server } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['subusers', uuid], queryFn: () => listSubusers(uuid), enabled: !!uuid });
  const deleteMut = useMutation({ mutationFn: (u: string) => deleteSubuser(uuid, u), onSuccess: () => qc.invalidateQueries({ queryKey: ['subusers', uuid] }) });
  const subusers = data?.data ?? [];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-medium text-neutral-100">Subusers</h2>
      </div>
      {isLoading && <p className="text-neutral-400">Loading…</p>}
      {!isLoading && subusers.length === 0 && <p className="py-8 text-center text-neutral-400">No subusers assigned to this server.</p>}
      <div className="space-y-2">
        {subusers.map((u) => (
          <div key={u.uuid} className="flex items-center justify-between rounded bg-neutral-700/60 p-4">
            <div>
              <p className="font-medium text-neutral-100">{u.username}</p>
              <p className="text-xs text-neutral-400">{u.email} · {u.permissions.length} permissions</p>
            </div>
            <Button.Danger size="small" onClick={() => { if (confirm(`Remove ${u.username}?`)) deleteMut.mutate(u.uuid); }}>Remove</Button.Danger>
          </div>
        ))}
      </div>
    </div>
  );
}
