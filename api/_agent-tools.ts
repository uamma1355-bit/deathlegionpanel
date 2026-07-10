/**
 * Real tool-calling layer for the autonomous AI agent.
 *
 * Tools hit the Pterodactyl panel REST API directly via the Vercel proxy.
 * Authentication uses the user's browser cookies (forwarded by the caller),
 * so actions execute AS the logged-in user — no admin privilege escalation.
 *
 * Each tool returns a JSON-serialisable result the LLM can reason about.
 */

import type { VercelRequest } from '@vercel/node';

const PANEL_BASE = 'https://deathlegionpanel.vercel.app';

/** Forward the user's cookies + CSRF token so tools act as the calling user. */
function buildHeaders(req: VercelRequest): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (req.headers['cookie']) h['Cookie'] = req.headers['cookie'] as string;
  if (req.headers['x-xsrf-token']) h['X-XSRF-TOKEN'] = req.headers['x-xsrf-token'] as string;
  if (req.headers['referer']) h['Referer'] = req.headers['referer'] as string;
  return h;
}

async function panelFetch(req: VercelRequest, method: string, path: string, body?: any): Promise<any> {
  const url = PANEL_BASE + path;
  const init: RequestInit = {
    method,
    headers: buildHeaders(req),
    credentials: 'include',
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const r = await fetch(url, init);
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* plain text response */ }
  if (!r.ok) {
    const detail = json?.errors?.[0]?.detail || json?.message || text.slice(0, 300);
    return { ok: false, status: r.status, error: detail };
  }
  return { ok: true, status: r.status, data: json };
}

// ---------------------------------------------------------------------------
// Tool definitions exposed to the LLM. The LLM emits tool calls as JSON lines
// wrapped in <tool_call>...</tool_call> blocks (parsed by the orchestrator).
// ---------------------------------------------------------------------------

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export const TOOL_DEFINITIONS: ToolDef[] = [
  {
    name: 'list_servers',
    description: 'List all servers the current user has access to. Returns id (identifier), uuid, name, status, node, limits.',
    parameters: {},
  },
  {
    name: 'get_server',
    description: 'Get detailed info about a specific server: name, status, docker image, startup command, limits, egg, node.',
    parameters: { server: { type: 'string', description: 'Server identifier (short id) or UUID', required: true } },
  },
  {
    name: 'get_resources',
    description: 'Get live CPU / memory / disk usage for a server (must be running).',
    parameters: { server: { type: 'string', description: 'Server identifier', required: true } },
  },
  {
    name: 'send_power',
    description: 'Send a power action to a server: start, stop, restart, or kill.',
    parameters: {
      server: { type: 'string', description: 'Server identifier', required: true },
      action: { type: 'string', description: 'One of: start, stop, restart, kill', required: true },
    },
  },
  {
    name: 'send_command',
    description: 'Send a raw console command to a running server (e.g. "say hello", "help", "list"). For shell bots, this sends text to stdin.',
    parameters: {
      server: { type: 'string', description: 'Server identifier', required: true },
      command: { type: 'string', description: 'The command text to send', required: true },
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory on the server. Returns name, size, modified, type (file/dir).',
    parameters: {
      server: { type: 'string', description: 'Server identifier', required: true },
      directory: { type: 'string', description: 'Directory path (default "/")', required: false },
    },
  },
  {
    name: 'read_file',
    description: 'Read the text contents of a file on the server.',
    parameters: {
      server: { type: 'string', description: 'Server identifier', required: true },
      file: { type: 'string', description: 'File path (e.g. "index.js", "package.json")', required: true },
    },
  },
  {
    name: 'write_file',
    description: 'Write text content to a file on the server (overwrites existing). Use for creating/editing bot code, configs, package.json, etc.',
    parameters: {
      server: { type: 'string', description: 'Server identifier', required: true },
      file: { type: 'string', description: 'File path', required: true },
      content: { type: 'string', description: 'Full file contents', required: true },
    },
  },
  {
    name: 'install_packages',
    description: 'Install npm packages on a Node.js server. Triggers `npm install <packages>` via the server console. Server must be running.',
    parameters: {
      server: { type: 'string', description: 'Server identifier', required: true },
      packages: { type: 'string', description: 'Space-separated package list (e.g. "axios discord.js")', required: true },
    },
  },
  {
    name: 'restart_with_new_code',
    description: 'Convenience: writes a file, then restarts the server so the new code runs. Atomically writes file then sends power restart.',
    parameters: {
      server: { type: 'string', description: 'Server identifier', required: true },
      file: { type: 'string', description: 'File path to write', required: true },
      content: { type: 'string', description: 'Full file contents', required: true },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function tool_list_servers(req: VercelRequest, _args: any) {
  const r = await panelFetch(req, 'GET', '/api/client');
  if (!r.ok) return r;
  const servers = (r.data?.data || []).map((s: any) => ({
    id: s.attributes.identifier,
    uuid: s.attributes.uuid,
    name: s.attributes.name,
    status: s.attributes.status,
    node: s.attributes.node,
    egg: s.attributes.egg,
    limits: s.attributes.limits,
  }));
  return { ok: true, count: servers.length, servers };
}

async function tool_get_server(req: VercelRequest, args: { server: string }) {
  if (!args.server) return { ok: false, error: 'server parameter required' };
  const r = await panelFetch(req, 'GET', `/api/client/servers/${args.server}`);
  if (!r.ok) return r;
  const a = r.data?.attributes;
  return {
    ok: true,
    server: {
      id: a.identifier,
      uuid: a.uuid,
      name: a.name,
      status: a.status,
      docker_image: a.docker_image,
      startup: a.container?.startup_command,
      limits: a.limits,
      egg: a.egg,
      node: a.node,
    },
  };
}

async function tool_get_resources(req: VercelRequest, args: { server: string }) {
  if (!args.server) return { ok: false, error: 'server parameter required' };
  const r = await panelFetch(req, 'GET', `/api/client/servers/${args.server}/resources`);
  if (!r.ok) return r;
  const a = r.data?.attributes;
  return {
    ok: true,
    state: a.current_state,
    cpu_percent: a.resources?.cpu_absolute,
    memory_mb: a.resources?.memory_bytes ? Math.round(a.resources.memory_bytes / 1024 / 1024) : 0,
    disk_mb: a.resources?.disk_bytes ? Math.round(a.resources.disk_bytes / 1024 / 1024) : 0,
    uptime_sec: a.resources?.uptime,
    network_rx_bytes: a.resources?.network_rx_bytes,
    network_tx_bytes: a.resources?.network_tx_bytes,
  };
}

async function tool_send_power(req: VercelRequest, args: { server: string; action: string }) {
  if (!args.server || !args.action) return { ok: false, error: 'server and action required' };
  const valid = ['start', 'stop', 'restart', 'kill'];
  if (!valid.includes(args.action)) return { ok: false, error: `action must be one of: ${valid.join(', ')}` };
  const r = await panelFetch(req, 'POST', `/api/client/servers/${args.server}/power`, { signal: args.action });
  return r.ok ? { ok: true, message: `Power signal "${args.action}" sent to server ${args.server}` } : r;
}

async function tool_send_command(req: VercelRequest, args: { server: string; command: string }) {
  if (!args.server || !args.command) return { ok: false, error: 'server and command required' };
  const r = await panelFetch(req, 'POST', `/api/client/servers/${args.server}/command`, { command: args.command });
  return r.ok ? { ok: true, message: `Command sent to server ${args.server}: ${args.command}` } : r;
}

async function tool_list_files(req: VercelRequest, args: { server: string; directory?: string }) {
  if (!args.server) return { ok: false, error: 'server parameter required' };
  const dir = args.directory || '/';
  const r = await panelFetch(req, 'GET', `/api/client/servers/${args.server}/files/list?directory=${encodeURIComponent(dir)}`);
  if (!r.ok) return r;
  const files = (r.data || []).map((f: any) => ({
    name: f.name,
    type: f.file ? 'file' : 'dir',
    size: f.size,
    modified: f.modified,
    mode: f.mode,
  }));
  return { ok: true, directory: dir, count: files.length, files };
}

async function tool_read_file(req: VercelRequest, args: { server: string; file: string }) {
  if (!args.server || !args.file) return { ok: false, error: 'server and file required' };
  const r = await panelFetch(req, 'GET', `/api/client/servers/${args.server}/files/contents?file=${encodeURIComponent(args.file)}`);
  if (!r.ok) return r;
  // Pterodactyl returns raw file contents (string), not JSON
  const content = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
  const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n... (truncated)' : content;
  return { ok: true, file: args.file, size: content.length, content: truncated };
}

async function tool_write_file(req: VercelRequest, args: { server: string; file: string; content: string }) {
  if (!args.server || !args.file || args.content === undefined) return { ok: false, error: 'server, file, and content required' };
  const r = await panelFetch(req, 'PUT', `/api/client/servers/${args.server}/files/write?file=${encodeURIComponent(args.file)}`, args.content);
  // Pterodactyl expects raw body, but we sent JSON — try POST fallback
  if (!r.ok) {
    // Try with raw text body
    const init: RequestInit = {
      method: 'PUT',
      headers: {
        ...buildHeaders(req),
        'Content-Type': 'text/plain',
      },
      credentials: 'include',
      body: args.content,
    };
    if (req.headers['cookie']) (init.headers as any)['Cookie'] = req.headers['cookie'];
    if (req.headers['x-xsrf-token']) (init.headers as any)['X-XSRF-TOKEN'] = req.headers['x-xsrf-token'];
    const r2 = await fetch(`${PANEL_BASE}/api/client/servers/${args.server}/files/write?file=${encodeURIComponent(args.file)}`, init);
    if (!r2.ok) {
      const t = await r2.text();
      return { ok: false, status: r2.status, error: t.slice(0, 300) };
    }
    return { ok: true, message: `Wrote ${args.content.length} bytes to ${args.file}` };
  }
  return { ok: true, message: `Wrote ${args.content.length} bytes to ${args.file}` };
}

async function tool_install_packages(req: VercelRequest, args: { server: string; packages: string }) {
  if (!args.server || !args.packages) return { ok: false, error: 'server and packages required' };
  const cmd = `npm install ${args.packages}`;
  return tool_send_command(req, { server: args.server, command: cmd });
}

async function tool_restart_with_new_code(req: VercelRequest, args: { server: string; file: string; content: string }) {
  const write = await tool_write_file(req, args);
  if (!write.ok) return write;
  const power = await tool_send_power(req, { server: args.server, action: 'restart' });
  return {
    ok: power.ok,
    message: `Wrote ${args.content.length} bytes to ${args.file} and sent restart signal`,
    write_result: write,
    power_result: power,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function executeTool(req: VercelRequest, name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case 'list_servers': return await tool_list_servers(req, args);
      case 'get_server': return await tool_get_server(req, args);
      case 'get_resources': return await tool_get_resources(req, args);
      case 'send_power': return await tool_send_power(req, args);
      case 'send_command': return await tool_send_command(req, args);
      case 'list_files': return await tool_list_files(req, args);
      case 'read_file': return await tool_read_file(req, args);
      case 'write_file': return await tool_write_file(req, args);
      case 'install_packages': return await tool_install_packages(req, args);
      case 'restart_with_new_code': return await tool_restart_with_new_code(req, args);
      default: return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e: any) {
    return { ok: false, error: `Tool execution threw: ${e?.message || String(e)}` };
  }
}

/** Parse <tool_call>{"name":"...","args":{...}}</tool_call> blocks from LLM output. */
export function parseToolCalls(text: string): Array<{ name: string; args: any; raw: string }> {
  const out: Array<{ name: string; args: any; raw: string }> = [];
  const re = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed.name) {
        out.push({ name: parsed.name, args: parsed.args || parsed.parameters || {}, raw: m[0] });
      }
    } catch { /* skip malformed */ }
  }
  return out;
}

/** Strip tool_call blocks from LLM output to get the human-readable text. */
export function stripToolCalls(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
}

/** Build a plain-text tool catalog for the system prompt. */
export function toolCatalogForPrompt(): string {
  return TOOL_DEFINITIONS.map(t => {
    const params = Object.entries(t.parameters).map(([k, v]) => {
      const req = v.required ? ' (required)' : ' (optional)';
      return `    - ${k} (${v.type})${req}: ${v.description}`;
    }).join('\n');
    return `- ${t.name}: ${t.description}` + (params ? '\n  Parameters:\n' + params : '');
  }).join('\n\n');
}
