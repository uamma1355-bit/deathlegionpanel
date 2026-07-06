/** Backups page */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBackups, createBackup, deleteBackup, getBackupDownloadUrl, restoreBackup } from '@/api/server';
import { useServer } from '@/state/server-context';
import { Button } from '@/components/elements/button/Button';

export function ServerBackupsPage(): JSX.Element {
  const { server } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['backups', uuid], queryFn: () => listBackups(uuid), enabled: !!uuid });
  const createMut = useMutation({ mutationFn: () => createBackup(uuid), onSuccess: () => qc.invalidateQueries({ queryKey: ['backups', uuid] }) });
  const deleteMut = useMutation({ mutationFn: (b: string) => deleteBackup(uuid, b), onSuccess: () => qc.invalidateQueries({ queryKey: ['backups', uuid] }) });
  const backups = data?.data ?? [];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-medium text-neutral-100">Backups</h2>
        <Button size="small" onClick={() => createMut.mutate()} disabled={createMut.isPending}>Create Backup</Button>
      </div>
      {isLoading && <p className="text-neutral-400">Loading…</p>}
      {!isLoading && backups.length === 0 && <p className="py-8 text-center text-neutral-400">No backups found.</p>}
      <div className="space-y-2">
        {backups.map((b) => (
          <div key={b.uuid} className="flex items-center justify-between rounded bg-neutral-700/60 p-4">
            <div>
              <p className="font-medium text-neutral-100">{b.name || b.uuid}</p>
              <p className="text-xs text-neutral-400">{new Date(b.created_at).toLocaleString()} · {(b.bytes / 1024 / 1024).toFixed(1)} MB {b.is_locked && '🔒'}</p>
            </div>
            <div className="flex gap-2">
              <Button.Text size="small" onClick={async () => { const url = await getBackupDownloadUrl(uuid, b.uuid); if (url) window.open(url, '_blank'); }}>Download</Button.Text>
              <Button.Text size="small" onClick={() => { if (confirm('Restore this backup?')) restoreBackup(uuid, b.uuid); }}>Restore</Button.Text>
              <Button.Danger size="small" onClick={() => { if (confirm('Delete this backup?')) deleteMut.mutate(b.uuid); }}>Delete</Button.Danger>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
