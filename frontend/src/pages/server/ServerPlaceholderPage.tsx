/**
 * Placeholder for server sub-pages not yet wired in Phase 3.
 * Styled like upstream ScreenBlock (centered, neutral card).
 */

import { useServer } from '@/state/server-context';

export function ServerPlaceholderPage({ title }: { title: string }): JSX.Element {
  const { server } = useServer();
  return (
    <div className="rounded border border-dashed border-neutral-500 bg-neutral-700/40 p-6 text-center">
      <h2 className="mb-2 text-lg font-medium text-neutral-100">{title}</h2>
      <p className="mx-auto max-w-md text-sm text-neutral-400">
        This area is part of Phase 3 (see <code className="text-neutral-300">docs/02-MigrationStrategy.md</code>).
        The backend endpoints already exist — the React page needs to be wired in.
      </p>
      <p className="mt-3 text-xs text-neutral-500">
        Server UUID: <span className="font-mono">{server?.attributes.uuid ?? '—'}</span>
      </p>
    </div>
  );
}
