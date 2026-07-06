/** Databases page */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDatabases, createDatabase, deleteDatabase, rotateDatabasePassword } from '@/api/server';
import { useServer } from '@/state/server-context';
import { Button } from '@/components/elements/button/Button';
import { Input } from '@/components/elements/inputs/Input';
import { useState } from 'react';

export function ServerDatabasesPage(): JSX.Element {
  const { server } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const qc = useQueryClient();
  const [newDb, setNewDb] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['databases', uuid], queryFn: () => listDatabases(uuid), enabled: !!uuid });
  const createMut = useMutation({ mutationFn: () => createDatabase(uuid, newDb, '%'), onSuccess: () => { setNewDb(''); qc.invalidateQueries({ queryKey: ['databases', uuid] }); } });
  const deleteMut = useMutation({ mutationFn: (d: string) => deleteDatabase(uuid, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['databases', uuid] }) });
  const rotateMut = useMutation({ mutationFn: (d: string) => rotateDatabasePassword(uuid, d) });
  const dbs = data?.data ?? [];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-medium text-neutral-100">Databases</h2>
        <div className="flex gap-2">
          <Input placeholder="New DB name" value={newDb} onChange={(e) => setNewDb(e.target.value)} className="w-40" />
          <Button size="small" onClick={() => createMut.mutate()} disabled={!newDb}>Create</Button>
        </div>
      </div>
      {isLoading && <p className="text-neutral-400">Loading…</p>}
      {!isLoading && dbs.length === 0 && <p className="py-8 text-center text-neutral-400">No databases configured.</p>}
      <div className="space-y-2">
        {dbs.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded bg-neutral-700/60 p-4">
            <div>
              <p className="font-medium text-neutral-100">{d.database}</p>
              <p className="text-xs text-neutral-400">User: {d.username} · Remote: {d.remote}</p>
            </div>
            <div className="flex gap-2">
              <Button.Text size="small" onClick={() => rotateMut.mutate(d.id)}>Rotate Password</Button.Text>
              <Button.Danger size="small" onClick={() => { if (confirm('Delete database?')) deleteMut.mutate(d.id); }}>Delete</Button.Danger>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
