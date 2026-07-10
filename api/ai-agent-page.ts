import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Autonomous AI Agent Page (BETA)
 * Fully uncensored autonomous AI that can develop, test, and deploy bots.
 * Uses z-ai-web-dev-sdk with agent mode.
 */

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
    .header { background:rgba(15,15,15,0.95); border-bottom:1px solid rgba(239,68,68,0.2); padding:0.8rem 1.5rem; display:flex; align-items:center; justify-content:space-between; }
    .logo { font-family:'Cinzel',serif; font-size:1.2rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c,#e89060); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; }
    .beta-badge { background:linear-gradient(135deg,#ef4444,#f87171); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.6rem; font-weight:700; text-transform:uppercase; margin-left:0.3rem; }
    .nav { display:flex; gap:0.4rem; }
    .nav a { padding:0.3rem 0.7rem; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:6px; color:#888; text-decoration:none; font-size:0.75rem; }
    .nav a:hover { color:#e89060; }
    .nav a.active { background:rgba(239,68,68,0.15); color:#f87171; }
    .container { flex:1; display:flex; flex-direction:column; max-width:900px; margin:0 auto; width:100%; }
    .warning { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:10px; padding:1rem; margin:1rem; text-align:center; }
    .warning h3 { color:#ef4444; font-size:0.9rem; margin-bottom:0.3rem; }
    .warning p { color:#888; font-size:0.8rem; }
    .terminal { flex:1; overflow-y:auto; padding:1rem; font-family:'JetBrains Mono',monospace; font-size:0.85rem; }
    .terminal-line { margin-bottom:0.5rem; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
    .terminal-line.user { color:#e89060; }
    .terminal-line.agent { color:#22c55e; }
    .terminal-line.system { color:#555; font-style:italic; }
    .terminal-line code { background:rgba(0,0,0,0.4); padding:0.1rem 0.3rem; border-radius:3px; }
    .terminal-line pre { background:rgba(0,0,0,0.4); padding:0.8rem; border-radius:8px; overflow-x:auto; margin:0.3rem 0; }
    .input-area { padding:1rem; background:rgba(15,15,15,0.95); border-top:1px solid rgba(239,68,68,0.15); }
    .input-wrap { display:flex; gap:0.5rem; max-width:900px; margin:0 auto; }
    .input-wrap input { flex:1; padding:0.7rem 1rem; background:rgba(20,20,20,0.8); border:1px solid rgba(239,68,68,0.15); border-radius:10px; color:#fff; font-size:0.9rem; font-family:'JetBrains Mono',monospace; }
    .input-wrap input:focus { outline:none; border-color:#ef4444; box-shadow:0 0 0 3px rgba(239,68,68,0.1); }
    .input-wrap button { padding:0.7rem 1.5rem; background:linear-gradient(135deg,#ef4444,#f87171); color:#fff; border:none; border-radius:10px; font-weight:600; cursor:pointer; font-size:0.9rem; }
    .input-wrap button:disabled { opacity:0.5; }
    .capabilities { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:0.5rem; margin:1rem; }
    .cap { background:rgba(20,20,20,0.8); border:1px solid rgba(239,68,68,0.1); border-radius:8px; padding:0.8rem; text-align:center; }
    .cap .icon { font-size:1.2rem; }
    .cap .name { color:#888; font-size:0.75rem; margin-top:0.2rem; }
    .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.2); border-top-color:#f87171; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .quick-actions { display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:center; margin-bottom:0.5rem; }
    .quick-btn { padding:0.3rem 0.7rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.15); border-radius:6px; color:#f87171; font-size:0.75rem; cursor:pointer; }
    .quick-btn:hover { background:rgba(239,68,68,0.2); }
  </style>
</head>
<body>
  <div class="header">
    <div><span class="logo">Death Legion</span><span class="beta-badge">AUTONOMOUS</span></div>
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
      <h3>⚠️ Autonomous AI Agent — BETA FEATURE</h3>
      <p>This is a fully autonomous, uncensored AI agent that can write, test, and deploy bots. Use with caution.</p>
    </div>
    <div class="capabilities">
      <div class="cap"><div class="icon">🔧</div><div class="name">Write Bot Code</div></div>
      <div class="cap"><div class="icon">🐛</div><div class="name">Debug Issues</div></div>
      <div class="cap"><div class="icon">🚀</div><div class="name">Deploy Bots</div></div>
      <div class="cap"><div class="icon">📊</div><div class="name">Monitor Performance</div></div>
      <div class="cap"><div class="icon">🧪</div><div class="name">Test Bots</div></div>
      <div class="cap"><div class="icon">📦</div><div class="name">Install Packages</div></div>
    </div>
    <div class="terminal" id="terminal">
      <div class="terminal-line system">[System] Autonomous AI Agent initialized. Ready for commands.</div>
      <div class="terminal-line system">[System] Type a command or use quick actions below.</div>
    </div>
    <div class="input-area">
      <div class="quick-actions">
        <div class="quick-btn" onclick="sendCommand('Build a complete WhatsApp bot with ping, help, and sticker commands')">Build a WhatsApp bot</div>
        <div class="quick-btn" onclick="sendCommand('Create a Python Discord bot template')">Create Python bot</div>
        <div class="quick-btn" onclick="sendCommand('Debug: my bot keeps disconnecting from WhatsApp')">Debug disconnect</div>
        <div class="quick-btn" onclick="sendCommand('Generate a QR code authentication system for Baileys')">Generate QR auth</div>
      </div>
      <div class="input-wrap">
        <input type="text" id="cmdInput" placeholder="Enter command for autonomous agent..." onkeypress="if(event.key==='Enter')sendCommand()" />
        <button id="execBtn" onclick="sendCommand()">Execute</button>
      </div>
    </div>
  </div>
  <script>
    let history = [];
    async function sendCommand(text) {
      const input = document.getElementById('cmdInput');
      const cmd = text || input.value.trim();
      if (!cmd) return;
      input.value = '';
      const btn = document.getElementById('execBtn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      addLine('user', '> ' + cmd);
      history.push({ role: 'user', content: cmd });
      addLine('system', '[Agent] Processing command...');
      try {
        const res = await fetch('/api/ai-assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: cmd, mode: 'agent', history })
        });
        const data = await res.json();
        if (data.success) {
          addLine('agent', data.response);
          history.push({ role: 'assistant', content: data.response });
        } else {
          addLine('system', '[Error] ' + (data.error || 'Unknown'));
        }
      } catch(e) { addLine('system', '[Error] ' + e.message); }
      btn.disabled = false; btn.textContent = 'Execute';
    }
    function addLine(type, content) {
      const term = document.getElementById('terminal');
      const div = document.createElement('div');
      div.className = 'terminal-line ' + type;
      // Format code blocks
      let formatted = content
        .replace(/\\\`\\\`\\\`([\\w]*?)\\n([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$2</code></pre>')
        .replace(/\\\`([^\`]+)\\\`/g, '<code>$1</code>');
      div.innerHTML = formatted;
      term.appendChild(div);
      term.scrollTop = term.scrollHeight;
    }
  </script>
</body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(AGENT_PAGE);
}
