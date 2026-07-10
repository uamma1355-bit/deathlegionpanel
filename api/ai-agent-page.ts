import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Autonomous AI Agent Page
 * Real agent with live tool-calling UI — shows every tool call,
 * its arguments, the result, and the duration. Terminal-style.
 */

const NAV_LOGO_URL = 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=120&h=120&fit=crop&q=80';

const AGENT_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Autonomous AI Agent</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:#080808; color:#e5e5e5; min-height:100vh; display:flex; flex-direction:column; }
    body { background-image: linear-gradient(rgba(8,8,8,0.92), rgba(8,8,8,0.95)), url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80'); background-size:cover; background-position:center; background-attachment:fixed; }
    .header { background:rgba(15,15,15,0.95); border-bottom:1px solid rgba(239,68,68,0.2); padding:0.8rem 1.5rem; display:flex; align-items:center; justify-content:space-between; backdrop-filter:blur(10px); position:sticky; top:0; z-index:100; }
    .logo-wrap { display:flex; align-items:center; gap:0.6rem; }
    .logo-img { width:32px; height:32px; border-radius:8px; object-fit:cover; border:1px solid rgba(239,68,68,0.4); box-shadow:0 0 10px rgba(239,68,68,0.3); }
    .logo { font-family:'Cinzel',serif; font-size:1.2rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c,#e89060); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; }
    .beta-badge { background:linear-gradient(135deg,#ef4444,#f87171); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.6rem; font-weight:700; text-transform:uppercase; margin-left:0.3rem; }
    .nav { display:flex; gap:0.4rem; }
    .nav a { padding:0.3rem 0.7rem; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:6px; color:#888; text-decoration:none; font-size:0.75rem; }
    .nav a:hover { color:#e89060; }
    .nav a.active { background:rgba(239,68,68,0.15); color:#f87171; }
    .container { flex:1; display:flex; flex-direction:column; max-width:1100px; margin:0 auto; width:100%; }
    .warning { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:10px; padding:0.8rem 1rem; margin:1rem; text-align:center; }
    .warning h3 { color:#ef4444; font-size:0.85rem; margin-bottom:0.2rem; }
    .warning p { color:#888; font-size:0.75rem; }
    .capabilities { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:0.5rem; margin:0 1rem 1rem; }
    .cap { background:rgba(20,20,20,0.85); border:1px solid rgba(239,68,68,0.12); border-radius:8px; padding:0.7rem; text-align:center; transition:all 0.2s; }
    .cap:hover { border-color:rgba(239,68,68,0.3); transform:translateY(-1px); }
    .cap .icon { font-size:1.1rem; }
    .cap .name { color:#aaa; font-size:0.7rem; margin-top:0.2rem; font-weight:600; }
    .terminal { flex:1; overflow-y:auto; padding:1rem; font-family:'JetBrains Mono',monospace; font-size:0.85rem; min-height:400px; }
    .terminal-line { margin-bottom:0.5rem; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
    .terminal-line.user { color:#e89060; }
    .terminal-line.agent { color:#22c55e; }
    .terminal-line.system { color:#555; font-style:italic; }
    .terminal-line.error { color:#ef4444; }
    .terminal-line code { background:rgba(0,0,0,0.4); padding:0.1rem 0.3rem; border-radius:3px; }
    .terminal-line pre { background:rgba(0,0,0,0.5); padding:0.8rem; border-radius:8px; overflow-x:auto; margin:0.3rem 0; border:1px solid rgba(255,255,255,0.05); }
    .tool-call { background:rgba(239,68,68,0.06); border-left:3px solid #ef4444; padding:0.6rem 0.9rem; border-radius:6px; margin:0.4rem 0; }
    .tool-call .tc-header { color:#f87171; font-weight:600; font-size:0.8rem; margin-bottom:0.3rem; }
    .tool-call .tc-args { color:#888; font-size:0.75rem; margin-bottom:0.3rem; }
    .tool-call .tc-args code { background:rgba(0,0,0,0.4); padding:0.1rem 0.3rem; border-radius:3px; color:#aaa; }
    .tool-call .tc-result { background:rgba(0,0,0,0.3); padding:0.5rem; border-radius:4px; font-size:0.75rem; color:#aaa; max-height:200px; overflow-y:auto; border:1px solid rgba(255,255,255,0.05); }
    .tool-call .tc-result.ok { border-left:2px solid #22c55e; }
    .tool-call .tc-result.fail { border-left:2px solid #ef4444; }
    .tool-call .tc-meta { color:#555; font-size:0.7rem; margin-top:0.3rem; }
    .input-area { padding:1rem; background:rgba(15,15,15,0.95); border-top:1px solid rgba(239,68,68,0.15); backdrop-filter:blur(10px); }
    .input-wrap { display:flex; gap:0.5rem; max-width:1100px; margin:0 auto; }
    .input-wrap input { flex:1; padding:0.7rem 1rem; background:rgba(20,20,20,0.85); border:1px solid rgba(239,68,68,0.15); border-radius:10px; color:#fff; font-size:0.9rem; font-family:'JetBrains Mono',monospace; }
    .input-wrap input:focus { outline:none; border-color:#ef4444; box-shadow:0 0 0 3px rgba(239,68,68,0.1); }
    .input-wrap button { padding:0.7rem 1.5rem; background:linear-gradient(135deg,#ef4444,#f87171); color:#fff; border:none; border-radius:10px; font-weight:600; cursor:pointer; font-size:0.9rem; }
    .input-wrap button:disabled { opacity:0.5; cursor:not-allowed; }
    .quick-actions { display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:center; margin-bottom:0.5rem; }
    .quick-btn { padding:0.3rem 0.7rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.15); border-radius:6px; color:#f87171; font-size:0.75rem; cursor:pointer; transition:all 0.15s; }
    .quick-btn:hover { background:rgba(239,68,68,0.2); transform:translateY(-1px); }
    .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.2); border-top-color:#f87171; border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .status-pill { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:600; }
    .status-pill.idle { background:rgba(100,100,100,0.2); color:#888; }
    .status-pill.working { background:rgba(239,68,68,0.15); color:#f87171; }
    .status-pill.done { background:rgba(34,197,94,0.15); color:#22c55e; }
    .status-pill .dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
    .status-pill.working .dot { animation:pulse 1s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    .scroll-hint { text-align:center; color:#555; font-size:0.7rem; padding:0.3rem; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-wrap">
      <img src="${NAV_LOGO_URL}" class="logo-img" alt="DL" />
      <div><span class="logo">Death Legion</span><span class="beta-badge">AUTONOMOUS</span></div>
    </div>
    <div class="nav">
      <a href="/">Panel</a>
      <a href="/credits">Credits</a>
      <a href="/ai-assistant">AI</a>
      <a href="/ai-agent" class="active">Agent</a>
      <a href="/statistics">Stats</a>
    </div>
  </div>
  <div class="container">
    <div class="warning">
      <h3>Autonomous AI Agent — Real Tool Execution</h3>
      <p>This agent has REAL access to your servers: list, start/stop/restart, send commands, read & write files, install npm packages — all as your account.</p>
    </div>
    <div class="capabilities">
      <div class="cap"><div class="icon">📊</div><div class="name">List Servers</div></div>
      <div class="cap"><div class="icon">⚡</div><div class="name">Power Control</div></div>
      <div class="cap"><div class="icon">⌨️</div><div class="name">Send Commands</div></div>
      <div class="cap"><div class="icon">📂</div><div class="name">List Files</div></div>
      <div class="cap"><div class="icon">📖</div><div class="name">Read Files</div></div>
      <div class="cap"><div class="icon">✏️</div><div class="name">Write Files</div></div>
      <div class="cap"><div class="icon">📦</div><div class="name">Install Packages</div></div>
      <div class="cap"><div class="icon">🔄</div><div class="name">Restart w/ Code</div></div>
    </div>
    <div class="terminal" id="terminal">
      <div class="terminal-line system">[System] Autonomous AI Agent initialised.</div>
      <div class="terminal-line system">[System] Logged in as your panel account — tool calls execute with your permissions.</div>
      <div class="terminal-line system">[System] Try: "list my servers", "show me CPU usage for server abc123", "write a hello-world bot to index.js on server abc123 and restart it".</div>
    </div>
    <div class="input-area">
      <div class="quick-actions">
        <div class="quick-btn" onclick="sendCommand('List all my servers')">List servers</div>
        <div class="quick-btn" onclick="sendCommand('Show me the current CPU and memory usage of my first server')">Resource usage</div>
        <div class="quick-btn" onclick="sendCommand('List files in the root directory of my first server')">List files</div>
        <div class="quick-btn" onclick="sendCommand('Read package.json from my first server')">Read package.json</div>
        <div class="quick-btn" onclick="sendCommand('Write a complete WhatsApp Baileys bot with ping and help commands to index.js on my first server, then restart it')">Build & deploy WhatsApp bot</div>
        <div class="quick-btn" onclick="sendCommand('Restart my first server')">Restart server</div>
      </div>
      <div class="input-wrap">
        <input type="text" id="cmdInput" placeholder="Ask the agent to do anything on your servers..." onkeypress="if(event.key==='Enter')sendCommand()" />
        <button id="execBtn" onclick="sendCommand()">Execute</button>
      </div>
    </div>
  </div>
  <script>
    let history = [];
    let working = false;

    function setStatus(state, label) {
      var btn = document.getElementById('execBtn');
      if (state === 'working') {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> ' + (label || 'Working');
      } else {
        btn.disabled = false;
        btn.textContent = 'Execute';
      }
      working = state === 'working';
    }

    function addLine(type, content) {
      const term = document.getElementById('terminal');
      const div = document.createElement('div');
      div.className = 'terminal-line ' + type;
      let formatted = content
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
      const resultStr = JSON.stringify(result, null, 2);
      const truncatedResult = resultStr.length > 2000 ? resultStr.slice(0, 2000) + '\\n... (truncated)' : resultStr;
      div.innerHTML =
        '<div class="tc-header">🔧 ' + escapeHtml(tool) + '</div>' +
        '<div class="tc-args"><pre style="margin:0;background:none;padding:0;">' + escapeHtml(argsStr) + '</pre></div>' +
        '<div class="tc-result ' + (ok ? 'ok' : 'fail') + '"><pre style="margin:0;background:none;padding:0;">' + escapeHtml(truncatedResult) + '</pre></div>' +
        '<div class="tc-meta">' + (ok ? '✓' : '✗') + ' ' + durationMs + 'ms</div>';
      term.appendChild(div);
      term.scrollTop = term.scrollHeight;
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    }

    async function sendCommand(text) {
      if (working) return;
      const input = document.getElementById('cmdInput');
      const cmd = text || input.value.trim();
      if (!cmd) return;
      input.value = '';
      addLine('user', '> ' + cmd);
      history.push({ role: 'user', content: cmd });
      addLine('system', '[Agent] Thinking...');
      setStatus('working', 'Thinking');

      try {
        const res = await fetch('/api/ai-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message: cmd, mode: 'agent', history })
        });
        const data = await res.json();

        // Remove the "Thinking..." line
        const term = document.getElementById('terminal');
        const lines = term.querySelectorAll('.terminal-line.system');
        if (lines.length > 0 && lines[lines.length - 1].textContent.includes('Thinking')) {
          lines[lines.length - 1].remove();
        }

        if (data.success) {
          if (data.tool_calls && data.tool_calls.length > 0) {
            addLine('system', '[Agent] Executed ' + data.tool_calls.length + ' tool call' + (data.tool_calls.length === 1 ? '' : 's') + ' in ' + (data.iterations || 1) + ' iteration' + (data.iterations === 1 ? '' : 's') + ':');
            data.tool_calls.forEach(function(tc) {
              addToolCall(tc.tool, tc.args, tc.result, tc.duration_ms);
            });
            addLine('system', '[Agent] Final response:');
          }
          addLine('agent', data.response || '(no response)');
          history.push({ role: 'assistant', content: data.response });
        } else {
          addLine('error', '[Error] ' + (data.error || 'Unknown error'));
          if (data.tool_calls && data.tool_calls.length > 0) {
            data.tool_calls.forEach(function(tc) {
              addToolCall(tc.tool, tc.args, tc.result, tc.duration_ms);
            });
          }
        }
      } catch(e) {
        addLine('error', '[Network Error] ' + e.message);
      }
      setStatus('idle');
    }
  </script>
</body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(AGENT_PAGE);
}
