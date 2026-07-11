import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from './_design';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Autonomous AI Agent</title>
  <style>${DESIGN_SYSTEM_CSS}
    body { display:flex; flex-direction:column; }
    .agent-container { flex:1; display:grid; grid-template-columns:360px 1fr; gap:1rem; max-width:1400px; margin:0 auto; width:100%; padding:1rem 1.5rem; }
    @media (max-width:900px) { .agent-container { grid-template-columns:1fr; } }
    .agent-panel { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.2rem; }
    .panel-title { font-family:var(--dl-font-display); font-size:0.85rem; font-weight:700; color:var(--dl-bronze-light); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.8rem; padding-bottom:0.6rem; border-bottom:1px solid var(--dl-border); display:flex; align-items:center; gap:0.4rem; }
    .tool-btn { display:flex; align-items:center; gap:0.5rem; width:100%; padding:0.65rem 0.85rem; background:rgba(20,20,20,0.6); border:1px solid var(--dl-border); border-radius:var(--dl-radius); color:var(--dl-text-muted); font-size:0.82rem; cursor:pointer; transition:var(--dl-transition); text-align:left; margin-bottom:0.35rem; font-family:var(--dl-font-body); font-weight:500; }
    .tool-btn:hover { background:rgba(188,110,60,0.08); border-color:rgba(188,110,60,0.3); color:var(--dl-bronze-light); transform:translateX(3px); }
    .tool-btn .icon { font-size:1.05rem; }
    .tool-btn .label { flex:1; }
    .tool-btn .shortcut { font-size:0.62rem; color:var(--dl-text-dim); font-family:var(--dl-font-mono); }
    .tool-btn.deploy { border-color:rgba(34,197,94,0.15); background:rgba(34,197,94,0.04); }
    .tool-btn.deploy:hover { background:rgba(34,197,94,0.1); border-color:rgba(34,197,94,0.3); color:#22c55e; }
    .terminal-panel { display:flex; flex-direction:column; min-height:500px; }
    .terminal { flex:1; overflow-y:auto; padding:1.1rem; font-family:var(--dl-font-mono); font-size:0.8rem; background:rgba(0,0,0,0.4); border:1px solid var(--dl-border); border-radius:var(--dl-radius); margin-bottom:0.8rem; max-height:calc(100vh - 250px); min-height:300px; }
    .terminal-line { margin-bottom:0.4rem; line-height:1.6; white-space:pre-wrap; word-break:break-word; animation:dl-fade-in 0.2s ease-out; }
    .terminal-line.user { color:var(--dl-bronze-light); }
    .terminal-line.agent { color:var(--dl-green); }
    .terminal-line.system { color:var(--dl-text-dim); font-style:italic; }
    .terminal-line.error { color:var(--dl-red); }
    .terminal-line code { background:rgba(0,0,0,0.4); padding:0.1rem 0.35rem; border-radius:3px; }
    .terminal-line pre { background:rgba(0,0,0,0.5); padding:0.6rem; border-radius:var(--dl-radius-sm); overflow-x:auto; margin:0.3rem 0; border:1px solid var(--dl-border); font-size:0.75rem; }
    .tool-call { background:rgba(188,110,60,0.05); border-left:3px solid var(--dl-bronze); padding:0.65rem 0.9rem; border-radius:var(--dl-radius-sm); margin:0.5rem 0; animation:dl-slide-in 0.3s ease-out; }
    .tool-call .tc-header { color:var(--dl-bronze-light); font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; display:flex; align-items:center; justify-content:space-between; }
    .tool-call .tc-args { color:var(--dl-text-muted); font-size:0.7rem; margin-bottom:0.3rem; }
    .tool-call .tc-args pre { margin:0; background:none; padding:0; border:none; }
    .tool-call .tc-result { background:rgba(0,0,0,0.4); padding:0.5rem; border-radius:var(--dl-radius-sm); font-size:0.7rem; color:var(--dl-text-muted); max-height:240px; overflow-y:auto; border:1px solid var(--dl-border); }
    .tool-call .tc-result.ok { border-left:2px solid var(--dl-green); }
    .tool-call .tc-result.fail { border-left:2px solid var(--dl-red); }
    .tool-call .tc-result pre { margin:0; background:none; padding:0; border:none; }
    .tool-call .tc-meta { color:var(--dl-text-dim); font-size:0.65rem; margin-top:0.3rem; }
    .input-wrap { display:flex; gap:0.5rem; }
    .input-wrap input { flex:1; padding:0.7rem 1rem; background:var(--dl-bg-input); border:1px solid var(--dl-border); border-radius:var(--dl-radius); color:var(--dl-text); font-size:0.85rem; font-family:var(--dl-font-mono); transition:var(--dl-transition); }
    .input-wrap input:focus { outline:none; border-color:rgba(188,110,60,0.5); box-shadow:0 0 0 3px rgba(188,110,60,0.1); }
    .mode-tabs { display:flex; gap:0.3rem; margin-bottom:0.8rem; align-items:center; }
    .mode-tab { padding:0.35rem 0.8rem; background:rgba(20,20,20,0.6); border:1px solid var(--dl-border); border-radius:var(--dl-radius-sm); color:var(--dl-text-muted); font-size:0.72rem; cursor:pointer; transition:var(--dl-transition); font-family:var(--dl-font-body); }
    .mode-tab:hover { color:var(--dl-bronze-light); }
    .server-list { max-height:200px; overflow-y:auto; margin-bottom:0.6rem; }
    .server-item { padding:0.55rem 0.75rem; background:rgba(20,20,20,0.5); border:1px solid var(--dl-border); border-radius:var(--dl-radius-sm); margin-bottom:0.3rem; cursor:pointer; transition:var(--dl-transition); }
    .server-item:hover { border-color:rgba(188,110,60,0.3); background:rgba(188,110,60,0.06); transform:translateX(2px); }
    .server-item.selected { border-color:rgba(188,110,60,0.5); background:rgba(188,110,60,0.1); }
    .server-item .si-name { color:var(--dl-text); font-size:0.8rem; font-weight:600; }
    .server-item .si-id { color:var(--dl-text-dim); font-size:0.68rem; font-family:var(--dl-font-mono); }
    .server-item .si-status { float:right; font-size:0.62rem; padding:2px 7px; border-radius:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
    .si-status.running { background:rgba(34,197,94,0.15); color:var(--dl-green); }
    .si-status.offline { background:rgba(239,68,68,0.15); color:var(--dl-red); }
    .si-status.starting { background:rgba(234,179,8,0.15); color:var(--dl-yellow); }
    .llm-warning { background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); border-radius:var(--dl-radius-sm); padding:0.6rem 0.8rem; font-size:0.7rem; color:var(--dl-green); margin-bottom:0.6rem; line-height:1.5; }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/ai-agent')}
  <div class="agent-container">
    <!-- LEFT: Direct Tool Panel -->
    <div class="agent-panel">
      <div class="panel-title">⚡ Direct Tools</div>
      <div id="llmWarning" class="llm-warning">✓ Agent ready — NL parser online. Type commands or use buttons below.</div>
      <div class="server-list" id="serverList">
        <div style="color:var(--dl-text-dim);font-size:0.75rem;text-align:center;padding:0.5rem;">Loading servers...</div>
      </div>
      <button class="tool-btn" onclick="execDirect('list_servers',{})">
        <span class="icon">📊</span><span class="label">List Servers</span><span class="shortcut">refresh</span>
      </button>
      <button class="tool-btn" onclick="promptServerTool('get_resources','Get resource usage for server')">
        <span class="icon">📈</span><span class="label">Resource Usage</span><span class="shortcut">CPU/RAM</span>
      </button>
      <button class="tool-btn" onclick="promptServerTool('list_files','List files in server (enter directory, or empty for /)')">
        <span class="icon">📂</span><span class="label">List Files</span><span class="shortcut">browse</span>
      </button>
      <button class="tool-btn" onclick="promptServerFileTool('read_file','Read file from server')">
        <span class="icon">📖</span><span class="label">Read File</span><span class="shortcut">view</span>
      </button>
      <button class="tool-btn" onclick="promptWriteFile()">
        <span class="icon">✏️</span><span class="label">Write File</span><span class="shortcut">edit</span>
      </button>
      <button class="tool-btn" onclick="promptPowerAction()">
        <span class="icon">⚡</span><span class="label">Power Control</span><span class="shortcut">start/stop</span>
      </button>
      <button class="tool-btn" onclick="promptServerTool('send_command','Send console command to server')">
        <span class="icon">⌨️</span><span class="label">Send Command</span><span class="shortcut">console</span>
      </button>
      <button class="tool-btn" onclick="promptInstallPackages()">
        <span class="icon">📦</span><span class="label">Install Packages</span><span class="shortcut">npm</span>
      </button>
      <button class="tool-btn deploy" onclick="promptDeployBot()">
        <span class="icon">🚀</span><span class="label">Deploy WhatsApp Bot</span><span class="shortcut">1-click</span>
      </button>
    </div>

    <!-- RIGHT: Terminal + LLM -->
    <div class="agent-panel terminal-panel">
      <div class="mode-tabs">
        <span style="color:var(--dl-bronze-light);font-family:var(--dl-font-display);font-size:0.85rem;font-weight:700;letter-spacing:0.05em;">TERMINAL</span>
        <button class="mode-tab" onclick="setMode('clear')" style="margin-left:auto;">Clear</button>
      </div>
      <div class="terminal" id="terminal">
        <div class="terminal-line system">[System] Death Legion Autonomous Agent initialised.</div>
        <div class="terminal-line system">[System] NL command parser online — type: "list servers", "restart server abc123", "deploy bot", "read file index.js on server abc123", etc.</div>
        <div class="terminal-line system">[System] Type "help" for full command list. Use the left panel for direct tool buttons.</div>
      </div>
      <div class="input-wrap">
        <input type="text" id="cmdInput" placeholder="Ask the agent to do anything... (e.g. 'list my servers and restart the first one')" onkeypress="if(event.key==='Enter')sendLLM()" />
        <button id="execBtn" class="dl-btn dl-btn-primary" onclick="sendLLM()">Send</button>
      </div>
    </div>
  </div>
  <script>
    let working = false;
    let selectedServer = null;

    function setStatus(state, label) {
      var btn = document.getElementById('execBtn');
      if (state === 'working') {
        btn.disabled = true;
        btn.innerHTML = '<span class="dl-spinner"></span> ' + (label || 'Working');
      } else {
        btn.disabled = false;
        btn.textContent = 'Send';
      }
      working = state === 'working';
    }

    function addLine(type, content) {
      const term = document.getElementById('terminal');
      const div = document.createElement('div');
      div.className = 'terminal-line ' + type;
      let formatted = String(content)
        .replace(/\\\`\\\`\\\`([\\w]*)\\n([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$2</code></pre>')
        .replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>');
      div.innerHTML = formatted;
      term.appendChild(div);
      term.scrollTop = term.scrollHeight;
      return div;
    }

    function addToolCall(tool, args, result, durationMs) {
      const term = document.getElementById('terminal');
      const div = document.createElement('div');
      div.className = 'tool-call';
      const ok = result && result.ok !== false;
      const argsStr = Object.keys(args||{}).length ? JSON.stringify(args, null, 2) : '(no args)';
      let resultStr = JSON.stringify(result, null, 2);
      if (resultStr.length > 3000) resultStr = resultStr.slice(0, 3000) + '\\n... (truncated)';
      div.innerHTML =
        '<div class="tc-header"><span>🔧 ' + escapeHtml(tool) + '</span><span>' + (ok ? '✓' : '✗') + '</span></div>' +
        '<div class="tc-args"><pre>' + escapeHtml(argsStr) + '</pre></div>' +
        '<div class="tc-result ' + (ok ? 'ok' : 'fail') + '"><pre>' + escapeHtml(resultStr) + '</pre></div>' +
        '<div class="tc-meta">' + durationMs + 'ms</div>';
      term.appendChild(div);
      term.scrollTop = term.scrollHeight;
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    }

    function setMode(mode) {
      if (mode === 'clear') {
        document.getElementById('terminal').innerHTML = '<div class="terminal-line system">[System] Terminal cleared.</div>';
      }
    }

    async function execDirect(tool, args) {
      if (working) return;
      addLine('user', '> [direct] ' + tool + ' ' + JSON.stringify(args));
      setStatus('working', 'Executing');
      try {
        const res = await fetch('/api/agent-tools', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ tool, args })
        });
        const data = await res.json();
        addToolCall(data.tool || tool, data.args || args, data.result || data, data.duration_ms || 0);
        if (tool === 'list_servers' && data.result && data.result.servers) {
          renderServerList(data.result.servers);
        }
      } catch(e) { addLine('error', '[Network Error] ' + e.message); }
      setStatus('idle');
    }

    function renderServerList(servers) {
      const list = document.getElementById('serverList');
      if (!servers || servers.length === 0) {
        list.innerHTML = '<div style="color:var(--dl-text-dim);font-size:0.75rem;text-align:center;padding:0.5rem;">No servers found</div>';
        return;
      }
      list.innerHTML = '<div style="color:var(--dl-text-muted);font-size:0.65rem;margin-bottom:0.4rem;padding:0 0.3rem;text-transform:uppercase;letter-spacing:0.08em;">Your Servers</div>';
      servers.forEach(function(s) {
        const div = document.createElement('div');
        div.className = 'server-item';
        div.onclick = function() {
          selectedServer = s.id;
          document.querySelectorAll('.server-item').forEach(function(el){ el.classList.remove('selected'); });
          div.classList.add('selected');
          addLine('system','[System] Selected server: ' + s.name + ' (' + s.id + ')');
        };
        const statusClass = s.status === 'running' ? 'running' : (s.status === 'starting' ? 'starting' : 'offline');
        div.innerHTML = '<div><span class="si-name">' + escapeHtml(s.name) + '</span><span class="si-status ' + statusClass + '">' + escapeHtml(s.status || 'offline') + '</span></div><div class="si-id">' + escapeHtml(s.id) + '</div>';
        list.appendChild(div);
      });
    }

    function promptServerTool(tool, promptText) {
      const server = prompt(promptText + '\\n\\nEnter server identifier (or click a server in the list first):', selectedServer || '');
      if (!server) return;
      let args = { server: server };
      if (tool === 'list_files') { args.directory = prompt('Directory path (empty for /):', '/') || '/'; }
      else if (tool === 'send_command') { const cmd = prompt('Console command to send:', 'help'); if (!cmd) return; args.command = cmd; }
      execDirect(tool, args);
    }
    function promptServerFileTool(tool, promptText) {
      const server = prompt(promptText + '\\n\\nServer identifier:', selectedServer || ''); if (!server) return;
      const file = prompt('File path:', 'index.js'); if (!file) return;
      execDirect(tool, { server: server, file: file });
    }
    function promptWriteFile() {
      const server = prompt('Write file — server identifier:', selectedServer || ''); if (!server) return;
      const file = prompt('File path:', 'index.js'); if (!file) return;
      const content = prompt('File contents (use \\\\n for new lines):', "console.log('Hello from Death Legion');\\n"); if (content === null) return;
      execDirect('write_file', { server: server, file: file, content: content.replace(/\\\\n/g, '\\n') });
    }
    function promptPowerAction() {
      const server = prompt('Power control — server identifier:', selectedServer || ''); if (!server) return;
      const action = prompt('Action (start / stop / restart / kill):', 'restart'); if (!action) return;
      execDirect('send_power', { server: server, action: action });
    }
    function promptInstallPackages() {
      const server = prompt('Install npm packages — server identifier:', selectedServer || ''); if (!server) return;
      const pkgs = prompt('Packages (space-separated):', 'axios'); if (!pkgs) return;
      execDirect('install_packages', { server: server, packages: pkgs });
    }
    function promptDeployBot() {
      if (!confirm('This will write a complete WhatsApp Baileys bot to index.js on the selected server and restart it. Continue?')) return;
      const server = prompt('Deploy WhatsApp bot — server identifier:', selectedServer || ''); if (!server) return;
      addLine('user', '> [deploy] Writing WhatsApp bot to server ' + server);
      deployBotToServer(server);
    }

    // NL Parser
    let history = [];
    let cachedServers = [];
    function extractServerId(text) {
      var m = text.match(/\\b([a-f0-9]{8})\\b/i); if (m) return m[1];
      m = text.match(/server\\s+([a-zA-Z0-9_-]+)/i); if (m) return m[1];
      if (selectedServer) return selectedServer; return null;
    }
    function findServerByName(name) {
      if (!cachedServers || cachedServers.length === 0) return null;
      var lower = name.toLowerCase();
      return cachedServers.find(function(s) { return s.name.toLowerCase() === lower; })
        || cachedServers.find(function(s) { return s.name.toLowerCase().indexOf(lower) !== -1 || lower.indexOf(s.name.toLowerCase()) !== -1; });
    }
    async function ensureServersLoaded() {
      if (cachedServers.length > 0) return;
      try {
        var r = await fetch('/api/agent-tools', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ tool:'list_servers', args:{} }) });
        var d = await r.json();
        if (d.result && d.result.servers) { cachedServers = d.result.servers; renderServerList(cachedServers); }
      } catch(e) {}
    }
    async function parseAndExecute(cmd) {
      var lower = cmd.toLowerCase().trim();
      addLine('user', '> ' + cmd);
      await ensureServersLoaded();
      if (lower === 'help' || lower === '?' || lower === 'commands') {
        addLine('agent', 'Available commands:\\n  • list servers / show my servers\\n  • start/stop/restart/kill server <id>\\n  • cpu / resources / usage for server <id>\\n  • list files [dir] on server <id>\\n  • read file <path> on server <id>\\n  • write file <path> on server <id>: <content>\\n  • install <packages> on server <id>\\n  • deploy bot to server <id>\\n  • build a whatsapp bot\\n\\nTip: Click a server in the left panel to select it, then you can omit the server ID.');
        return true;
      }
      if (lower.match(/^(list|show|my)\\s*(servers|server)?$/) || lower.includes('list servers') || lower.includes('show servers') || lower.includes('my servers')) {
        await execDirect('list_servers', {}); return true;
      }
      if (lower.includes('deploy') && lower.includes('bot') || lower.includes('build') && lower.includes('bot') || lower.includes('whatsapp bot')) {
        var deployServer = extractServerId(cmd);
        if (!deployServer) { var nameMatch = cmd.match(/(?:server|to|on)\\s+([a-zA-Z0-9_\\s-]+)/i); if (nameMatch) { var found = findServerByName(nameMatch[1].trim()); if (found) deployServer = found.id; } }
        if (!deployServer && cachedServers.length > 0) { deployServer = cachedServers[0].id; addLine('system', '[Agent] Using first server: ' + cachedServers[0].name + ' (' + deployServer + ')'); }
        if (!deployServer) { addLine('error', 'Could not determine which server to deploy to. Click a server first or specify the ID.'); return true; }
        addLine('system', '[Agent] Deploying WhatsApp bot to server ' + deployServer + '...');
        await deployBotToServer(deployServer); return true;
      }
      var powerMatch = lower.match(/(start|stop|restart|kill)\\s+server\\s+([a-f0-9]{8}|[a-zA-Z0-9_-]+)/i);
      if (!powerMatch) powerMatch = lower.match(/(start|stop|restart|kill)\\s+([a-f0-9]{8})/i);
      if (powerMatch) { var action = powerMatch[1].toLowerCase(); var sid = powerMatch[2]; if (!sid.match(/^[a-f0-9]{8}$/i)) { var byName = findServerByName(sid); if (byName) sid = byName.id; } await execDirect('send_power', { server: sid, action: action }); return true; }
      if (lower.includes('cpu') || lower.includes('resource') || lower.includes('usage') || lower.includes('memory') || lower.includes('ram')) { var resServer = extractServerId(cmd); if (resServer) { await execDirect('get_resources', { server: resServer }); return true; } }
      if (lower.includes('list files') || lower.includes('ls ') || lower.match(/list\\s+files/)) { var lsServer = extractServerId(cmd); if (lsServer) { var dirMatch = cmd.match(/(?:dir|directory|in|on)\\s+([\\/\\w.-]+)/i); var dir = dirMatch ? dirMatch[1] : '/'; await execDirect('list_files', { server: lsServer, directory: dir }); return true; } }
      if (lower.includes('read file') || lower.includes('cat ') || lower.includes('show file') || lower.includes('view file')) { var readFileMatch = cmd.match(/(?:read|cat|show|view)\\s+(?:file\\s+)?([\\/\\w.-]+)\\s+(?:on|from)?\\s*(?:server\\s+)?([a-f0-9]{8}|[a-zA-Z0-9_-]+)?/i); if (readFileMatch) { var filePath = readFileMatch[1]; var fileServer = readFileMatch[2] || selectedServer; if (fileServer && !fileServer.match(/^[a-f0-9]{8}$/i)) { var byName = findServerByName(fileServer); if (byName) fileServer = byName.id; } if (fileServer) { await execDirect('read_file', { server: fileServer, file: filePath }); return true; } } }
      if (lower.includes('write file') || lower.includes('create file') || lower.includes('edit file')) { var writeMatch = cmd.match(/(?:write|create|edit)\\s+(?:file\\s+)?([\\/\\w.-]+)\\s+(?:on|to)?\\s*(?:server\\s+)?([a-f0-9]{8}|[a-zA-Z0-9_-]+)?(?:\\s*[:=]\\s*|\\s+with\\s+)?([\\s\\S]*)?/i); if (writeMatch) { var wPath = writeMatch[1]; var wServer = writeMatch[2] || selectedServer; var wContent = writeMatch[3] || ''; if (wServer && !wServer.match(/^[a-f0-9]{8}$/i)) { var byName = findServerByName(wServer); if (byName) wServer = byName.id; } if (wServer) { await execDirect('write_file', { server: wServer, file: wPath, content: wContent }); return true; } } }
      if (lower.includes('install') && (lower.includes('npm') || lower.includes('package'))) { var installMatch = cmd.match(/install\\s+([\\w@.-]+(?:\\s+[\\w@.-]+)*)\\s+(?:on|to)?\\s*(?:server\\s+)?([a-f0-9]{8}|[a-zA-Z0-9_-]+)?/i); if (installMatch) { var packages = installMatch[1]; var instServer = installMatch[2] || selectedServer; if (instServer && !instServer.match(/^[a-f0-9]{8}$/i)) { var byName = findServerByName(instServer); if (byName) instServer = byName.id; } if (instServer) { await execDirect('install_packages', { server: instServer, packages: packages }); return true; } } }
      if (lower.includes('send command') || lower.includes('run command') || lower.includes('console command')) { var cmdMatch = cmd.match(/(?:send|run)\\s+command\\s+["'](.+?)["']\\s+(?:on|to)?\\s*(?:server\\s+)?([a-f0-9]{8}|[a-zA-Z0-9_-]+)?/i); if (cmdMatch) { var command = cmdMatch[1]; var cmdServer = cmdMatch[2] || selectedServer; if (cmdServer && !cmdServer.match(/^[a-f0-9]{8}$/i)) { var byName = findServerByName(cmdServer); if (byName) cmdServer = byName.id; } if (cmdServer) { await execDirect('send_command', { server: cmdServer, command: command }); return true; } } }
      return false;
    }

    async function deployBotToServer(serverId) {
      setStatus('working', 'Deploying');
      var botCode = [
        "const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');",
        "const { Boom } = require('@hapi/boom');",
        "const P = require('pino');",
        "",
        "async function start() {",
        "  const { state, saveCreds } = await useMultiFileAuthState('auth_state');",
        "  const sock = makeWASocket({ auth: state, printQRInTerminal: true, logger: P({ level: 'info' }) });",
        "  sock.ev.on('creds.update', saveCreds);",
        "  sock.ev.on('connection.update', (u) => {",
        "    if (u.connection === 'close') {",
        "      const r = new Boom(u.lastDisconnect?.error)?.output?.statusCode;",
        "      if (r !== DisconnectReason.loggedOut) start();",
        "    }",
        "  });",
        "  sock.ev.on('messages.upsert', async (m) => {",
        "    const msg = m.messages[0];",
        "    if (!msg.message || msg.key.fromMe) return;",
        "    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';",
        "    const from = msg.key.remoteJid;",
        "    if (text === '!ping') await sock.sendMessage(from, { text: 'pong! \\u{1F3D3}' });",
        "    else if (text === '!help') await sock.sendMessage(from, { text: 'Commands: !ping, !help, !hello' });",
        "    else if (text === '!hello') await sock.sendMessage(from, { text: 'Hello from Death Legion bot! \\u{1F480}' });",
        "  });",
        "}",
        "start();"
      ].join('\\n');
      var pkgJson = JSON.stringify({ name:'death-legion-bot', version:'1.0.0', main:'index.js', dependencies: { '@whiskeysockets/baileys':'^6.7.0', '@hapi/boom':'^10.0.1', 'pino':'^8.0.0' } }, null, 2);
      await execDirect('write_file', { server: serverId, file: 'package.json', content: pkgJson });
      await execDirect('write_file', { server: serverId, file: 'index.js', content: botCode });
      await execDirect('send_command', { server: serverId, command: 'npm install' });
      await execDirect('send_power', { server: serverId, action: 'restart' });
      addLine('agent', '\\u2705 WhatsApp bot deployed to server ' + serverId + '. Open the panel console to scan the QR code: https://deathlegionpanel.vercel.app/server/' + serverId);
      setStatus('idle');
    }

    async function sendLLM(text) {
      const input = document.getElementById('cmdInput');
      const cmd = text || input.value.trim();
      if (!cmd) return;
      input.value = '';
      setStatus('working', 'Processing');
      var handled = await parseAndExecute(cmd);
      if (handled) { setStatus('idle'); return; }
      addLine('system', '[Agent] Trying LLM mode...');
      history.push({ role: 'user', content: cmd });
      try {
        const res = await fetch('/api/ai-assistant', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ message: cmd, mode: 'agent', history }) });
        const data = await res.json();
        if (data.success) {
          if (data.tool_calls && data.tool_calls.length > 0) { addLine('system', '[Agent] Executed ' + data.tool_calls.length + ' tool call(s):'); data.tool_calls.forEach(function(tc) { addToolCall(tc.tool, tc.args, tc.result, tc.duration_ms); }); }
          addLine('agent', data.response || '(no response)');
          history.push({ role: 'assistant', content: data.response });
        } else {
          addLine('error', '[LLM Error] ' + (data.error || 'Unknown'));
          addLine('system', '[Hint] Use the direct tool buttons on the left, or try: "list servers", "restart server <id>", "deploy bot to server <id>"');
        }
      } catch(e) { addLine('error', '[Network Error] ' + e.message); }
      setStatus('idle');
    }

    (async function() {
      execDirect('list_servers', {});
    })();
  </script>
</body>
</html>`;

  return res.status(200).send(html);
}
