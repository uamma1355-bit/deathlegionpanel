#!/usr/bin/env node
/**
 * Minimal Wings stub for local development.
 *
 * Implements just enough of the Wings HTTP + WebSocket surface to let the
 * Pterodactyl frontend's console work end-to-end without a real daemon.
 *
 * Usage:
 *   node scripts/wings-stub.mjs
 *
 * Then point a node's `daemon_listen` to port 8080 in your panel's database.
 *
 * Reference: docs/07-WingsCompatibility.md
 *
 * What this stub does:
 *   - Validates Bearer token == "stub-daemon-token" (set this as the node's
 *     decrypted daemon_token for local dev — see `scripts/seed-stub-node.php`).
 *   - Responds to GET /api/servers/{uuid}/files?directory=... with an empty list.
 *   - Accepts POST /api/servers/{uuid}/power and logs the signal.
 *   - Accepts POST /api/servers/{uuid}/commands and logs the command.
 *   - Upgrades /api/servers/{uuid}/ws to a WebSocket that:
 *       * accepts { event: "auth", args: [token] }
 *       * replies { event: "auth success", args: [] }
 *       * emits { event: "status", args: ["running"] }
 *       * echoes commands back as console output
 *
 * NOT a substitute for real Wings — do not use in production.
 */

import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8080);
const BEARER = 'stub-daemon-token';

const server = http.createServer((req, res) => {
  const auth = req.headers.authorization ?? '';
  if (!auth.includes(BEARER)) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ errors: [{ code: 'Unauthorized', status: '401' }] }));
    return;
  }

  const url = new URL(req.url ?? '', `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','servers',uuid,...]

  if (req.method === 'GET' && parts[3] === 'files') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ object: 'list_of_files', data: [] }));
    return;
  }

  if (req.method === 'POST' && parts[3] === 'power') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      console.log(`[wings-stub] power ${parts[2]}: ${body}`);
      res.writeHead(204);
      res.end();
    });
    return;
  }

  if (req.method === 'POST' && parts[3] === 'commands') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      console.log(`[wings-stub] command ${parts[2]}: ${body}`);
      res.writeHead(204);
      res.end();
    });
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ errors: [{ code: 'NotFound', status: '404' }] }));
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const auth = req.headers.authorization ?? '';
  const url = new URL(req.url ?? '', `http://localhost:${PORT}`);
  if (!url.pathname.startsWith('/api/servers/') || !url.pathname.endsWith('/ws')) {
    socket.destroy();
    return;
  }
  // JWT in query string for WS auth — for the stub we ignore it.
  wss.handleUpgrade(req, socket, head, (ws) => {
    console.log(`[wings-stub] ws upgraded: ${url.pathname}`);

    let authed = false;
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.event === 'auth') {
        authed = true;
        ws.send(JSON.stringify({ event: 'auth success', args: [] }));
        ws.send(JSON.stringify({ event: 'status', args: ['running'] }));
        ws.send(JSON.stringify({ event: 'console output', args: ['[wings-stub] Connected to stub daemon.'] }));
        return;
      }
      if (msg.event === 'send logs') {
        ws.send(JSON.stringify({ event: 'console output', args: ['[wings-stub] No previous logs.'] }));
        return;
      }
      if (msg.event === 'send stats') {
        ws.send(JSON.stringify({ event: 'stats', args: [JSON.stringify({ cpu: 1.2, memory: 128, disk: 256 })] }));
        return;
      }
      if (msg.event === 'send command' && authed) {
        ws.send(JSON.stringify({ event: 'console output', args: [`> ${msg.args[0]}`] }));
        return;
      }
      if (msg.event === 'set state' && authed) {
        ws.send(JSON.stringify({ event: 'status', args: [msg.args[0]] }));
        return;
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`[wings-stub] listening on http://localhost:${PORT}`);
  console.log(`[wings-stub] expected Bearer: ${BEARER}`);
});
