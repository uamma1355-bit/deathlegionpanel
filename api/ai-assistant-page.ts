import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * AI Assistant Page — Chat with AI about bot development
 * Uses z-ai-web-dev-sdk backend API at /api/ai-assistant
 */

const AI_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — AI Assistant</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:#080808; color:#e5e5e5; min-height:100vh; display:flex; flex-direction:column; }
    .header { background:rgba(15,15,15,0.95); border-bottom:1px solid rgba(188,110,60,0.15); padding:0.8rem 1.5rem; display:flex; align-items:center; justify-content:space-between; }
    .logo { font-family:'Cinzel',serif; font-size:1.2rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c,#e89060); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; }
    .beta-badge { background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.6rem; font-weight:700; text-transform:uppercase; margin-left:0.3rem; }
    .nav { display:flex; gap:0.4rem; }
    .nav a { padding:0.3rem 0.7rem; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:6px; color:#888; text-decoration:none; font-size:0.75rem; }
    .nav a:hover { color:#e89060; }
    .nav a.active { background:rgba(188,110,60,0.15); color:#e89060; }
    .chat-container { flex:1; display:flex; flex-direction:column; max-width:800px; margin:0 auto; width:100%; }
    .messages { flex:1; overflow-y:auto; padding:1rem; }
    .msg { margin-bottom:1rem; max-width:85%; }
    .msg.user { margin-left:auto; }
    .msg-bubble { padding:0.8rem 1rem; border-radius:12px; font-size:0.9rem; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
    .msg.user .msg-bubble { background:linear-gradient(135deg,#bc6e3c,#d97f4a); color:#fff; border-bottom-right-radius:4px; }
    .msg.ai .msg-bubble { background:rgba(20,20,20,0.9); border:1px solid rgba(255,255,255,0.06); color:#e5e5e5; border-bottom-left-radius:4px; }
    .msg.ai .msg-bubble code { background:rgba(0,0,0,0.4); padding:0.1rem 0.3rem; border-radius:3px; font-family:'JetBrains Mono',monospace; font-size:0.85rem; }
    .msg.ai .msg-bubble pre { background:rgba(0,0,0,0.4); padding:0.8rem; border-radius:8px; overflow-x:auto; margin:0.5rem 0; }
    .msg.ai .msg-bubble pre code { background:none; padding:0; }
    .msg-label { font-size:0.7rem; color:#555; margin-bottom:0.2rem; }
    .input-area { padding:1rem; background:rgba(15,15,15,0.95); border-top:1px solid rgba(255,255,255,0.06); }
    .input-wrap { max-width:800px; margin:0 auto; display:flex; gap:0.5rem; }
    .input-wrap input { flex:1; padding:0.7rem 1rem; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:#fff; font-size:0.9rem; font-family:'Inter',sans-serif; }
    .input-wrap input:focus { outline:none; border-color:#bc6e3c; box-shadow:0 0 0 3px rgba(188,110,60,0.15); }
    .input-wrap button { padding:0.7rem 1.5rem; background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; border:none; border-radius:10px; font-weight:600; cursor:pointer; font-size:0.9rem; transition:all 0.2s; }
    .input-wrap button:hover { transform:translateY(-1px); box-shadow:0 4px 15px rgba(188,110,60,0.3); }
    .input-wrap button:disabled { opacity:0.5; cursor:not-allowed; }
    .mode-toggle { display:flex; gap:0.3rem; margin-bottom:0.5rem; justify-content:center; }
    .mode-btn { padding:0.3rem 0.8rem; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:6px; color:#666; font-size:0.75rem; cursor:pointer; }
    .mode-btn.active { background:rgba(188,110,60,0.15); color:#e89060; border-color:rgba(188,110,60,0.3); }
    .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.2); border-top-color:#e89060; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .welcome { text-align:center; padding:2rem; color:#555; }
    .welcome h2 { font-family:'Cinzel',serif; color:#e89060; margin-bottom:0.5rem; }
    .suggestions { display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center; margin-top:1rem; }
    .suggestion { padding:0.4rem 0.8rem; background:rgba(20,20,20,0.8); border:1px solid rgba(188,110,60,0.15); border-radius:8px; color:#888; font-size:0.8rem; cursor:pointer; transition:all 0.2s; }
    .suggestion:hover { border-color:rgba(188,110,60,0.3); color:#e89060; }
  </style>
</head>
<body>
  <div class="header">
    <div><span class="logo">Death Legion</span><span class="beta-badge">BETA</span></div>
    <div class="nav">
      <a href="/">Panel</a>
      <a href="/credits">Credits</a>
      <a href="/ai-assistant" class="active">AI</a>
      <a href="/ai-agent">Agent</a>
      <a href="/statistics">Stats</a>
    </div>
  </div>
  <div class="chat-container">
    <div class="messages" id="messages">
      <div class="welcome">
        <h2>AI Assistant</h2>
        <p>Ask me about bot development, Baileys API, debugging, or anything else.</p>
        <div class="suggestions">
          <div class="suggestion" onclick="sendMsg('How do I create a WhatsApp bot with Baileys?')">How to create a WhatsApp bot?</div>
          <div class="suggestion" onclick="sendMsg('Help me debug my bot connection issue')">Debug connection issue</div>
          <div class="suggestion" onclick="sendMsg('Write a ping-pong command for my bot')">Write a ping-pong command</div>
          <div class="suggestion" onclick="sendMsg('How to handle QR code scanning?')">QR code handling</div>
        </div>
      </div>
    </div>
    <div class="input-area">
      <div class="mode-toggle">
        <button class="mode-btn active" onclick="setMode('assistant')">Assistant Mode</button>
        <button class="mode-btn" onclick="setMode('agent')">Autonomous Agent Mode</button>
      </div>
      <div class="input-wrap">
        <input type="text" id="msgInput" placeholder="Ask AI anything..." onkeypress="if(event.key==='Enter')sendMsg()" />
        <button id="sendBtn" onclick="sendMsg()">Send</button>
      </div>
    </div>
  </div>
  <script>
    let mode = 'assistant';
    let history = [];
    function setMode(m) {
      mode = m;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      if (m === 'agent') {
        document.getElementById('msgInput').placeholder = 'Describe what you want the autonomous agent to build...';
      } else {
        document.getElementById('msgInput').placeholder = 'Ask AI anything...';
      }
    }
    async function sendMsg(text) {
      const input = document.getElementById('msgInput');
      const msg = text || input.value.trim();
      if (!msg) return;
      input.value = '';
      const btn = document.getElementById('sendBtn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      // Add user message
      addMsg('user', msg);
      history.push({ role: 'user', content: msg });
      try {
        const res = await fetch('/api/ai-assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, mode, history })
        });
        const data = await res.json();
        if (data.success) {
          addMsg('ai', data.response, mode === 'agent' ? 'Autonomous Agent' : 'AI Assistant');
          history.push({ role: 'assistant', content: data.response });
        } else {
          addMsg('ai', 'Error: ' + (data.error || 'Unknown error'));
        }
      } catch(e) { addMsg('ai', 'Error: ' + e.message); }
      btn.disabled = false; btn.textContent = 'Send';
    }
    function addMsg(role, content, label) {
      const messages = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = 'msg ' + role;
      const labelText = role === 'user' ? 'You' : (label || 'AI Assistant');
      div.innerHTML = '<div class="msg-label">' + labelText + '</div><div class="msg-bubble">' + formatContent(content) + '</div>';
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
    function formatContent(text) {
      // Simple code block formatting
      return text.replace(/\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$1</code></pre>')
                 .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                 .replace(/\\n/g, '<br>');
    }
  </script>
</body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(AI_PAGE);
}
