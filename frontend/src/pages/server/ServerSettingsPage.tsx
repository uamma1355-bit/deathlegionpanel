/** Settings page */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { renameServer, reinstallServer } from '@/api/server';
import { useServer } from '@/state/server-context';
import { Button } from '@/components/elements/button/Button';
import { Input } from '@/components/elements/inputs/Input';

export function ServerSettingsPage(): JSX.Element {
  const { server, refresh } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const [name, setName] = useState(server?.attributes?.name ?? '');
  const [desc, setDesc] = useState(server?.attributes?.description ?? '');

  const renameMut = useMutation({
    mutationFn: () => renameServer(uuid, name, desc),
    onSuccess: () => refresh(),
  });
  const reinstallMut = useMutation({ mutationFn: () => reinstallServer(uuid) });

  return (
    <div>
      <h2 className="mb-4 text-xl font-medium text-neutral-100">Settings</h2>
      <div className="max-w-lg space-y-6">
        <div className="space-y-4 rounded bg-neutral-700/60 p-4">
          <h3 className="font-medium text-neutral-100">Rename Server</h3>
          <Input label="Server Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button size="small" onClick={() => renameMut.mutate()} disabled={renameMut.isPending}>Save</Button>
        </div>
        <div className="space-y-4 rounded border border-red-800 bg-red-950/30 p-4">
          <h3 className="font-medium text-red-200">Danger Zone</h3>
          <p className="text-sm text-neutral-400">Reinstalling will wipe all server files and re-run the install script.</p>
          <Button.Danger size="small" onClick={() => { if (confirm('Reinstall server? This will wipe all files.')) reinstallMut.mutate(); }} disabled={reinstallMut.isPending}>Reinstall Server</Button.Danger>
        </div>
      </div>
    </div>
  );
}
