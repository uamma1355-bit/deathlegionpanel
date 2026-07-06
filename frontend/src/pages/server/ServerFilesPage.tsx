/**
 * Files page — Pterodactyl-style file browser.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFiles, createFolder, deleteFiles } from '@/api/server';
import { useServer } from '@/state/server-context';
import { Button } from '@/components/elements/button/Button';
import { Input } from '@/components/elements/inputs/Input';

export function ServerFilesPage(): JSX.Element {
  const { server } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const [directory, setDirectory] = useState('/');
  const [newFolder, setNewFolder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['files', uuid, directory],
    queryFn: () => listFiles(uuid, directory),
    enabled: !!uuid,
  });

  const createFolderMut = useMutation({
    mutationFn: () => createFolder(uuid, directory, newFolder),
    onSuccess: () => { setNewFolder(''); qc.invalidateQueries({ queryKey: ['files', uuid, directory] }); },
    onError: (e: unknown) => setError(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (files: string[]) => deleteFiles(uuid, directory, files),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files', uuid, directory] }),
    onError: (e: unknown) => setError(String(e)),
  });

  const files = data?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-medium text-neutral-100">File Manager</h2>
        <div className="flex gap-2">
          <Input placeholder="New folder name" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} className="w-40" />
          <Button size="small" onClick={() => createFolderMut.mutate()} disabled={!newFolder}>New Folder</Button>
        </div>
      </div>

      <div className="mb-2 text-sm text-neutral-400">
        <button onClick={() => setDirectory('/')} className="hover:text-neutral-200">root</button>
        <span> / </span>
        <span className="text-neutral-300">{directory === '/' ? '' : directory}</span>
      </div>

      {error && <div className="mb-2 rounded border border-red-700 bg-red-900/40 p-2 text-sm text-red-200">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-neutral-700">
        <table className="w-full text-sm">
          <thead className="bg-neutral-800 text-neutral-400">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-right">Size</th>
              <th className="px-4 py-2 text-right">Modified</th>
              <th className="px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-500">Loading…</td></tr>}
            {!isLoading && files.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-500">This directory is empty</td></tr>}
            {files.map((f) => (
              <tr key={f.name} className="border-t border-neutral-800 hover:bg-neutral-800/50">
                <td className="px-4 py-2">
                  <span className={f.is_file ? 'text-neutral-300' : 'text-cyan-400'}>
                    {f.is_file ? '📄' : '📁'} {f.name}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-neutral-400">{f.is_file ? formatBytes(f.size) : '—'}</td>
                <td className="px-4 py-2 text-right text-neutral-400">{new Date(f.modified_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-center">
                  {!f.is_file && (
                    <button onClick={() => setDirectory(directory === '/' ? `/${f.name}` : `${directory}/${f.name}`)} className="text-blue-400 hover:underline">Open</button>
                  )}
                  {' | '}
                  <button onClick={() => { if (confirm(`Delete ${f.name}?`)) deleteMut.mutate([f.name]); }} className="text-red-400 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
