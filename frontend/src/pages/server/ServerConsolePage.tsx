/**
 * Server Console — verbatim Pterodactyl console.
 * Black terminal + power buttons + stat blocks.
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
  const lineIdRef = useRef(0);
  const outputRef = useRef<HTMLDivElement>(null);

  const { state, send } = useServerWebSocket({
    serverUuid: uuid,
    enabled: !!uuid && canConsole,
    onEvent: (ev) => {
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

  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-4">
        <div className="col-span-3 hidden pr-4 sm:block lg:col-span-3">
          <h1 className="line-clamp-1 font-header text-2xl leading-relaxed text-gray-50">
            {server?.attributes?.name ?? 'Server'}
          </h1>
          <p className="line-clamp-2 text-sm">{server?.attributes?.description ?? ''}</p>
        </div>
        <div className="col-span-4 self-end sm:col-span-2 lg:col-span-1">
          <div className="flex space-x-2 sm:justify-end">
            {canStart && (
              <Button className="flex-1" disabled={serverState !== 'offline'} onClick={() => void handlePower('start')}>
                Start
              </Button>
            )}
            {canRestart && (
              <Button.Text className="flex-1" disabled={!serverState} onClick={() => void handlePower('restart')}>
                Restart
              </Button.Text>
            )}
            {canStop && (
              <Button.Danger className="flex-1" disabled={serverState === 'offline'} onClick={() => void handlePower(killable ? 'kill' : 'stop')}>
                {killable ? 'Kill' : 'Stop'}
              </Button.Danger>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2 sm:gap-4">
        <div className="col-span-4 flex lg:col-span-3">
          <div className="flex w-full flex-col">
            <div
              ref={outputRef}
              className="min-h-[16rem] flex-1 rounded-t bg-black p-2 font-mono text-sm text-gray-100"
              style={{ maxHeight: '32rem', overflow: 'auto' }}
            >
              {lines.length === 0 ? (
                <span className="text-neutral-600">Console output will appear here…</span>
              ) : (
                lines.map((line) => (
                  <div key={line.id} className="whitespace-pre-wrap break-all">{line.text}</div>
                ))
              )}
            </div>
            <form onSubmit={handleCommand} className="relative">
              <span className="absolute left-0 top-0 z-10 flex h-full select-none items-center px-3 text-neutral-400">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a command and press Enter…"
                className="w-full border-b-2 border-transparent bg-gray-900 py-2 pl-10 pr-4 font-mono text-sm text-gray-100 transition-colors duration-100 outline-none focus:border-cyan-500 active:border-cyan-500 sm:rounded-b"
              />
            </form>
          </div>
        </div>

        <div className="col-span-4 order-last lg:order-none lg:col-span-1">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <StatBlock label="Connection State" value={stateLabel} color={stateColor(serverState)} />
            <StatBlock
              label="Address"
              value={server?.attributes?.sftp_details
                ? `${server.attributes.sftp_details.ip ?? '—'}:${server.attributes.sftp_details.port ?? '—'}`
                : '—'}
            />
            <StatBlock label="CPU Limit" value={`${server?.attributes?.limits?.cpu ?? 0}%`} />
            <StatBlock label="Memory Limit" value={`${server?.attributes?.limits?.memory ?? 0} MB`} />
            <StatBlock label="Disk Limit" value={`${server?.attributes?.limits?.disk ?? 0} MB`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color?: string }): JSX.Element {
  return (
    <div className="relative flex items-center rounded px-3 py-2 shadow-lg md:p-3 lg:p-4" style={{ background: 'hsl(209, 14%, 37%)' }}>
      {color && <span className="absolute left-0 top-0 h-full w-1 rounded-l" style={{ background: color }} />}
      <div>
        <p className="text-2xs uppercase tracking-wide text-neutral-400">{label}</p>
        <p className="font-mono text-sm text-neutral-100">{value}</p>
      </div>
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
