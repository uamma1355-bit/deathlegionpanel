/**
 * Server Console — Pterodactyl-style.
 * Black terminal + power buttons + stat blocks + resource usage.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useServer } from '@/state/server-context';
import { useServerWebSocket } from '@/hooks/useServerWebSocket';
import { sendConsoleCommand, sendPowerCommand } from '@/api/server/resources';
import { Button } from '@/components/elements/button/Button';
import { PERMISSION } from '@shared/types/permission';

interface ConsoleLine { id: number; text: string; }

export function ServerConsolePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { server, permissions, isOwner } = useServer();
  const uuid = server?.attributes?.uuid ?? '';

  const canConsole = isOwner || (permissions?.includes(PERMISSION.CONTROL_CONSOLE) ?? false);
  const canStart = isOwner || (permissions?.includes(PERMISSION.CONTROL_START) ?? false);
  const canStop = isOwner || (permissions?.includes(PERMISSION.CONTROL_STOP) ?? false);
  const canRestart = isOwner || (permissions?.includes(PERMISSION.CONTROL_RESTART) ?? false);

  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [input, setInput] = useState('');
  const [serverState, setServerState] = useState<string>('offline');
  const [stats, setStats] = useState<{ cpu: number; memory: number; disk: number }>({ cpu: 0, memory: 0, disk: 0 });
  const lineIdRef = useRef(0);
  const outputRef = useRef<HTMLDivElement>(null);

  const { state, send } = useServerWebSocket({
    serverUuid: uuid,
    enabled: !!uuid && canConsole,
    onEvent: (ev) => {
      // Handle WebSocket events
      switch (ev.event) {
        case 'console output':
          if (typeof ev.args[0] === 'string') {
            setLines((prev) => [...prev.slice(-499), { id: lineIdRef.current++, text: ev.args[0] as string }]);
          }
          break;
        case 'initial status':
        case 'status':
          if (typeof ev.args[0] === 'string') setServerState(ev.args[0]);
          break;
        case 'stats':
          if (typeof ev.args[0] === 'string') {
            try {
              const s = JSON.parse(ev.args[0]);
              setStats({
                cpu: Math.round(s.cpu_absolute ?? 0),
                memory: Math.round((s.memory_bytes ?? 0) / 1024 / 1024),
                disk: Math.round((s.disk_bytes ?? 0) / 1024 / 1024),
              });
            } catch { /* ignore */ }
          }
          break;
      }
    },
  });

  useEffect(() => {
    if (state.authenticated) {
      send('send logs', []);
      send('send stats', []);
    }
  }, [state.authenticated, send]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  async function handlePower(signal: 'start' | 'stop' | 'restart' | 'kill'): Promise<void> {
    if (!id) return;
    try { await sendPowerCommand(id, signal); } catch (err) { console.error('power failed', err); }
  }

  async function handleCommand(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!id || !input.trim()) return;
    const cmd = input.trim();
    setInput('');
    try {
      await sendConsoleCommand(id, cmd);
      setLines((prev) => [...prev.slice(-499), { id: lineIdRef.current++, text: `> ${cmd}` }]);
    } catch (err) { console.error('command failed', err); }
  }

  const stateLabel = useMemo(() => {
    const map: Record<string, string> = {
      running: 'Running', starting: 'Starting', stopping: 'Stopping',
      stopped: 'Stopped', offline: 'Offline',
    };
    return map[serverState] ?? serverState;
  }, [serverState]);

  if (!canConsole) {
    return (
      <div className="rounded-md border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-300">
        You do not have permission to view the console on this server.
      </div>
    );
  }

  const killable = serverState === 'stopping';
  const limits = server?.attributes?.limits;

  return (
    <div>
      {/* Header: name + power buttons */}
      <div className="mb-4 grid grid-cols-4 gap-4">
        <div className="col-span-3 hidden pr-4 sm:block">
          <h1 className="line-clamp-1 font-header text-2xl leading-relaxed text-gray-50">
            {server?.attributes?.name ?? 'Server'}
          </h1>
          <p className="line-clamp-2 text-sm text-neutral-400">{server?.attributes?.description ?? ''}</p>
        </div>
        <div className="col-span-4 self-end sm:col-span-2 lg:col-span-1">
          <div className="flex space-x-2 sm:justify-end">
            {canStart && (
              <Button className="flex-1" disabled={serverState !== 'offline'} onClick={() => void handlePower('start')}>
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Start
                </span>
              </Button>
            )}
            {canRestart && (
              <Button.Text className="flex-1" disabled={!serverState || serverState === 'offline'} onClick={() => void handlePower('restart')}>
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6 M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
                  Restart
                </span>
              </Button.Text>
            )}
            {canStop && (
              <Button.Danger className="flex-1" disabled={serverState === 'offline'} onClick={() => void handlePower(killable ? 'kill' : 'stop')}>
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z" /></svg>
                  {killable ? 'Kill' : 'Stop'}
                </span>
              </Button.Danger>
            )}
          </div>
        </div>
      </div>

      {/* Console + Details */}
      <div className="mb-4 grid grid-cols-4 gap-2 sm:gap-4">
        <div className="col-span-4 flex lg:col-span-3">
          <div className="flex w-full flex-col">
            {/* Terminal output */}
            <div
              ref={outputRef}
              className="min-h-[20rem] flex-1 rounded-t bg-black p-3 font-mono text-sm text-gray-100"
              style={{ maxHeight: '40rem', overflow: 'auto' }}
            >
              {lines.length === 0 ? (
                <div className="flex h-full items-center justify-center text-neutral-600">
                  {state.status === 'open' && state.authenticated
                    ? 'Console output will appear here when the server is running…'
                    : state.lastError
                      ? `Connection failed: ${state.lastError}. The Wings daemon is running on the backend but the WebSocket URL (ws://localhost:8080) is not reachable from your browser. This is expected in the Daytona sandbox deployment. Power commands still work via the API.`
                      : 'Connecting to server…'}
                </div>
              ) : (
                lines.map((line) => (
                  <div key={line.id} className="whitespace-pre-wrap break-all leading-relaxed">{line.text}</div>
                ))
              )}
            </div>
            {/* Command input */}
            <form onSubmit={handleCommand} className="relative">
              <span className="absolute left-0 top-0 z-10 flex h-full select-none items-center px-3 text-cyan-500">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a command and press Enter…"
                className="w-full rounded-b border-b-2 border-transparent bg-gray-900 py-2.5 pl-10 pr-4 font-mono text-sm text-gray-100 transition-colors duration-100 outline-none focus:border-cyan-500"
              />
            </form>
          </div>
        </div>

        {/* Stat blocks */}
        <div className="col-span-4 order-last lg:order-none lg:col-span-1">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <StatBlock
              label="Connection State"
              value={stateLabel}
              color={stateColor(serverState)}
              icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>}
            />
            <StatBlock
              label="CPU Usage"
              value={`${stats.cpu}% / ${limits?.cpu ?? 0}%`}
              icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" /></svg>}
              progress={limits?.cpu ? (stats.cpu / limits.cpu) * 100 : 0}
            />
            <StatBlock
              label="Memory"
              value={`${stats.memory} / ${limits?.memory ?? 0} MB`}
              icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 6v12M11 6v12M15 6v12" /></svg>}
              progress={limits?.memory ? (stats.memory / limits.memory) * 100 : 0}
            />
            <StatBlock
              label="Disk"
              value={`${stats.disk} / ${limits?.disk ?? 0} MB`}
              icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>}
              progress={limits?.disk ? (stats.disk / limits.disk) * 100 : 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, color, icon, progress }: {
  label: string; value: string; color?: string; icon?: React.ReactNode; progress?: number;
}): JSX.Element {
  return (
    <div className="relative flex flex-col rounded px-3 py-2 shadow-lg md:p-3 lg:p-4" style={{ background: 'hsl(209, 14%, 37%)' }}>
      {color && <span className="absolute left-0 top-0 h-full w-1 rounded-l" style={{ background: color }} />}
      <div className="mb-1 flex items-center gap-1.5 text-neutral-400">
        {icon}
        <span className="text-2xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-mono text-sm text-neutral-100">{value}</p>
      {progress !== undefined && progress > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-900">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: progress > 90 ? 'hsl(0, 84%, 60%)' : progress > 70 ? 'hsl(45, 93%, 47%)' : 'hsl(142, 71%, 45%)',
            }}
          />
        </div>
      )}
    </div>
  );
}

function stateColor(state: string): string {
  switch (state) {
    case 'running': return 'hsl(142, 71%, 45%)';
    case 'starting': return 'hsl(45, 93%, 47%)';
    case 'stopping': return 'hsl(25, 95%, 53%)';
    default: return 'hsl(0, 84%, 60%)';
  }
}
