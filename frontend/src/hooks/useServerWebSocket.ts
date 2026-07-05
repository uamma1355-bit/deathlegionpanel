/**
 * React hook wrapping <openServerWebSocket> with proper lifecycle.
 *
 * Returns the current state + a stable `send` function. Inbound events
 * are delivered via the optional `onEvent` callback (re-subscribed on
 * every render — see implementation for why this is safe).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  openServerWebSocket,
  type ServerWsEvent,
  type ServerWsState,
  type ServerWebSocketHandle,
} from '@/api/server/websocket';

export interface UseServerWebSocketOptions {
  serverUuid: string;
  onEvent?: (event: ServerWsEvent) => void;
  enabled?: boolean;
}

export interface UseServerWebSocketResult {
  state: ServerWsState;
  send: (event: string, args: unknown[]) => void;
}

export function useServerWebSocket(options: UseServerWebSocketOptions): UseServerWebSocketResult {
  const { serverUuid, onEvent, enabled = true } = options;
  const [state, setState] = useState<ServerWsState>({ status: 'connecting', authenticated: false });
  const handleRef = useRef<ServerWebSocketHandle | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !serverUuid) return;
    const handle = openServerWebSocket({
      serverUuid,
      onStateChange: setState,
    });
    handleRef.current = handle;
    const unsub = handle.subscribe((ev) => onEventRef.current?.(ev));
    return () => {
      unsub();
      handle.close();
      handleRef.current = null;
    };
  }, [serverUuid, enabled]);

  const send = useCallback((event: string, args: unknown[]) => {
    handleRef.current?.send(event, args);
  }, []);

  return { state, send };
}
