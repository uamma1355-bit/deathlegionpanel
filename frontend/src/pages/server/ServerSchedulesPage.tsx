/** Schedules page */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSchedules, deleteSchedule, triggerSchedule } from '@/api/server';
import { useServer } from '@/state/server-context';
import { Button } from '@/components/elements/button/Button';

export function ServerSchedulesPage(): JSX.Element {
  const { server } = useServer();
  const uuid = server?.attributes?.uuid ?? '';
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['schedules', uuid], queryFn: () => listSchedules(uuid), enabled: !!uuid });
  const deleteMut = useMutation({ mutationFn: (id: number) => deleteSchedule(uuid, id), onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules', uuid] }) });
  const triggerMut = useMutation({ mutationFn: (id: number) => triggerSchedule(uuid, id) });
  const schedules = data?.data ?? [];
  return (
    <div>
      <h2 className="mb-4 text-xl font-medium text-neutral-100">Schedules</h2>
      {isLoading && <p className="text-neutral-400">Loading…</p>}
      {!isLoading && schedules.length === 0 && <p className="py-8 text-center text-neutral-400">No schedules configured.</p>}
      <div className="space-y-2">
        {schedules.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded bg-neutral-700/60 p-4">
            <div>
              <p className="font-medium text-neutral-100">{s.name} {!s.is_active && <span className="text-neutral-500">(disabled)</span>}</p>
              <p className="text-xs text-neutral-400">{s.cron_minute} {s.cron_hour} {s.cron_day_of_month} {s.cron_month} {s.cron_day_of_week} · Next: {s.next_run_at ? new Date(s.next_run_at).toLocaleString() : '—'}</p>
            </div>
            <div className="flex gap-2">
              <Button.Text size="small" onClick={() => triggerMut.mutate(s.id)}>Run Now</Button.Text>
              <Button.Danger size="small" onClick={() => { if (confirm('Delete schedule?')) deleteMut.mutate(s.id); }}>Delete</Button.Danger>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
