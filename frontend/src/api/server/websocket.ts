/**
 * WebSocket client for the server console.
 *
 * - Obtains a JWT from `/api/client/servers/{uuid}/websocket` (10-min TTL).
 * - Connects to Wings via `sockette` (auto-reconnect with backoff).
 * - Sends the `auth` event with the JWT on connect.
 * - Handles `token expiring` (re-auth in-place) and `token expired` (full reconnect).
 * - Exposes a subscribe() API so React components can listen to inbound events.
 *
 * See docs/07-WingsCompatibility.md §4 for the full client ↔ Wings protocol.
 */

import { z } from 'zod';
import Sockette from 'sockette';

import { getWebsocketToken } from '@/api/server/getWebsocketToken';

export interface ServerWsEvent {
  event: string;
  args: unknown[];
}

export type ServerWsListener = (event: ServerWsEvent) => void;

export interface ServerWsState {
  status: 'connecting' | 'open' | 'closed' | 'reconnecting';
  authenticated: boolean;
  lastError?: string;
}

export interface ServerWebSocketOptions {
  serverUuid: string;
  onStateChange?: (state: ServerWsState) => void;
}

export interface ServerWebSocketHandle {
  close: () => void;
  send: (event: string, args: unknown[]) => void;
  subscribe: (listener: ServerWsListener) => () => void;
  getState: () => ServerWsState;
}

const inboundSchema = z.object({ event: z.string(), args: z.array(z.unknown()) });

export function openServerWebSocket(options: ServerWebSocketOptions): ServerWebSocketHandle {
  const listeners = new Set<ServerWsListener>();
  let state: ServerWsState = { status: 'connecting', authenticated: false };
  let ws: Sockette | null = null;
  let currentToken: string | null = null;

  function setState(patch: Partial<ServerWsState>): void {
    state = { ...state, ...patch };
    options.onStateChange?.(state);
  }

  function emit(event: ServerWsEvent): void {
    listeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        console.error('[server-ws] listener threw', err);
      }
    });
  }

  function handleInbound(ev: ServerWsEvent): void {
    switch (ev.event) {
      case 'auth success':
        setState({ authenticated: true });
        break;
      case 'token expiring':
        void refreshAuth();
        break;
      case 'token expired':
        ws?.close();
        void fetchTokenAndConnect();
        break;
      default:
        emit(ev);
    }
  }

  async function refreshAuth(): Promise<void> {
    try {
      const tokenResp = await getWebsocketToken(options.serverUuid);
      currentToken = tokenResp.attributes.token;
      ws?.json({ event: 'auth', args: [currentToken] });
    } catch (err) {
      console.error('[server-ws] failed to refresh auth token', err);
      setState({ lastError: 'token refresh failed' });
    }
  }

  async function fetchTokenAndConnect(): Promise<void> {
    try {
      const tokenResp = await getWebsocketToken(options.serverUuid);
      currentToken = tokenResp.attributes.token;
      const socketUrl = tokenResp.attributes.socket;
      setState({ status: 'connecting', authenticated: false, lastError: undefined });

      ws = new Sockette(socketUrl, {
        timeout: 5_000,
        maxAttempts: 10,
        onopen: () => {
          setState({ status: 'open' });
          ws?.json({ event: 'auth', args: [currentToken] });
        },
        onmessage: (ev: MessageEvent<string>) => {
          try {
            const parsed = inboundSchema.parse(JSON.parse(ev.data));
            handleInbound(parsed);
          } catch (err) {
            console.warn('[server-ws] could not parse inbound message', err);
          }
        },
        onreconnect: () => {
          setState({ status: 'reconnecting' });
        },
        onclose: () => {
          setState({ status: 'closed', authenticated: false });
        },
        onerror: (ev: Event) => {
          const msg = ev instanceof ErrorEvent ? ev.message : 'socket error';
          setState({ lastError: msg });
        },
      });
    } catch (err) {
      console.error('[server-ws] initial connection failed', err);
      setState({
        status: 'closed',
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  }

  void fetchTokenAndConnect();

  return {
    close: () => {
      ws?.close();
      ws = null;
      listeners.clear();
    },
    send: (event: string, args: unknown[]) => {
      if (!ws || state.status !== 'open' || !state.authenticated) {
        console.warn('[server-ws] cannot send — socket not ready');
        return;
      }
      ws.json({ event, args });
    },
    subscribe: (listener: ServerWsListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
  };
}
