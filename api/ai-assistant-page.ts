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
  <title>Death Legion — AI Assistant</title>
  <style>${DESIGN_SYSTEM_CSS}
    body { display:flex; flex-direction:column; }
    .chat-container { flex:1; display:flex; flex-direction:column; max-width:850px; margin:0 auto; width:100%; padding:1rem 1.5rem 0; }
    .messages { flex:1; overflow-y:auto; padding:1rem 0; min-height:400px; max-height:calc(100vh - 220px); }
    .msg { margin-bottom:1rem; max-width:85%; animation:dl-fade-in 0.3s ease-out; }
    .msg.user { margin-left:auto; }
    .msg-label { font-size:0.68rem; color:var(--dl-text-dim); margin-bottom:0.2rem; text-transform:uppercase; letter-spacing:0.08em; font-weight:600; }
    .msg.user .msg-label { text-align:right; }
    .msg-bubble { padding:0.85rem 1.1rem; border-radius:var(--dl-radius-lg); font-size:0.9rem; line-height:1.6; white-space:pre-wrap; word-break:break-word; }
    .msg.user .msg-bubble { background:linear-gradient(135deg, var(--dl-bronze), #d97f4a); color:#fff; border-bottom-right-radius:4px; box-shadow:0 4px 12px rgba(188,110,60,0.2); }
    .msg.ai .msg-bubble { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); color:var(--dl-text); border-bottom-left-radius:4px; }
    .msg.ai .msg-bubble code { background:rgba(0,0,0,0.4); padding:0.15rem 0.4rem; border-radius:4px; font-family:var(--dl-font-mono); font-size:0.82rem; color:var(--dl-bronze-light); }
    .msg.ai .msg-bubble pre { background:rgba(0,0,0,0.5); padding:0.8rem; border-radius:var(--dl-radius); overflow-x:auto; margin:0.5rem 0; border:1px solid var(--dl-border); }
    .msg.ai .msg-bubble pre code { background:none; padding:0; color:var(--dl-text); }
    .input-area { padding:1rem 1.5rem; background:rgba(15,15,15,0.85); backdrop-filter:blur(16px); border-top:1px solid var(--dl-border); }
    .input-wrap { max-width:850px; margin:0 auto; display:flex; gap:0.5rem; align-items:center; }
    .input-wrap input { flex:1; padding:0.75rem 1.1rem; background:var(--dl-bg-input); border:1px solid var(--dl-border); border-radius:var(--dl-radius); color:var(--dl-text); font-size:0.9rem; font-family:var(--dl-font-body); transition:var(--dl-transition); }
    .input-wrap input:focus { outline:none; border-color:rgba(188,110,60,0.5); box-shadow:0 0 0 3px rgba(188,110,60,0.1); }
    .mode-toggle { display:flex; gap:0.3rem; margin-bottom:0.6rem; justify-content:center; max-width:850px; margin:0 auto 0.6rem; }
    .mode-btn { padding:0.35rem 0.9rem; background:rgba(20,20,20,0.8); border:1px solid var(--dl-border); border-radius:var(--dl-radius-sm); color:var(--dl-text-muted); font-size:0.75rem; cursor:pointer; transition:var(--dl-transition); font-family:var(--dl-font-body); font-weight:500; }
    .mode-btn:hover { color:var(--dl-bronze-light); }
    .mode-btn.active { background:rgba(188,110,60,0.15); color:var(--dl-bronze-light); border-color:rgba(188,110,60,0.3); }
    .welcome { text-align:center; padding:2.5rem 1rem; }
    .welcome h2 { font-family:var(--dl-font-display); color:var(--dl-bronze-light); margin-bottom:0.5rem; font-size:1.6rem; letter-spacing:0.05em; }
    .welcome p { color:var(--dl-text-muted); font-size:0.9rem; margin-bottom:1.5rem; }
    .suggestions { display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center; max-width:600px; margin:0 auto; }
    .suggestion { padding:0.5rem 1rem; background:var(--dl-bg-card); border:1px solid rgba(188,110,60,0.15); border-radius:var(--dl-radius); color:var(--dl-text-muted); font-size:0.8rem; cursor:pointer; transition:var(--dl-transition); backdrop-filter:blur(8px); }
    .suggestion:hover { border-color:rgba(188,110,60,0.4); color:var(--dl-bronze-light); transform:translateY(-2px); box-shadow:var(--dl-shadow-sm); }
    .typing { display:inline-flex; gap:3px; align-items:center; padding:0.3rem 0; }
    .typing span { width:6px; height:6px; border-radius:50%; background:var(--dl-bronze-light); animation:typing-bounce 1.4s ease-in-out infinite; }
    .typing span:nth-child(2) { animation-delay:0.2s; }
    .typing span:nth-child(3) { animation-delay:0.4s; }
    @keyframes typing-bounce { 0%,60%,100% { transform:translateY(0); opacity:0.4; } 30% { transform:translateY(-6px); opacity:1; } }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/ai-assistant')}
  <div class="chat-container">
    <div class="messages" id="messages">
      <div class="welcome">
        <h2>AI Assistant</h2>
        <p>Ask me about bot development, Baileys API, debugging, or anything else.</p>
        <div class="suggestions">
          <div class="suggestion" onclick="sendMsg('How do I create a WhatsApp bot with Baileys?')">💬 How to create a WhatsApp bot?</div>
          <div class="suggestion" onclick="sendMsg('Help me debug my bot connection issue')">🐛 Debug connection issue</div>
          <div class="suggestion" onclick="sendMsg('Write a ping-pong command for my bot')">⚡ Write a ping-pong command</div>
          <div class="suggestion" onclick="sendMsg('How to handle QR code scanning?')">📱 QR code handling</div>
        </div>
      </div>
    </div>
  </div>
  <div class="input-area">
    <div class="mode-toggle">
      <button class="mode-btn active" onclick="setMode('assistant', this)">💬 Assistant Mode</button>
      <button class="mode-btn" onclick="setMode('agent', this)">🤖 Autonomous Agent</button>
    </div>
    <div class="input-wrap">
      <input type="text" id="msgInput" placeholder="Ask AI anything..." onkeypress="if(event.key==='Enter')sendMsg()" />
      <button id="sendBtn" class="dl-btn dl-btn-primary" onclick="sendMsg()">Send</button>
    </div>
  </div>
  <script>
    let mode = 'assistant';
    let history = [];
    function setMode(m, btn) {
      mode = m;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('msgInput').placeholder = m === 'agent'
        ? 'Describe what you want the autonomous agent to build...'
        : 'Ask AI anything...';
    }
    async function sendMsg(text) {
      const input = document.getElementById('msgInput');
      const msg = text || input.value.trim();
      if (!msg) return;
      input.value = '';
      const btn = document.getElementById('sendBtn');
      btn.disabled = true; btn.innerHTML = '<span class="dl-spinner"></span>';
      addMsg('user', msg);
      history.push({ role: 'user', content: msg });
      // Typing indicator
      const typingId = addTypingIndicator();
      try {
        const res = await fetch('/api/ai-assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, mode, history })
        });
        const data = await res.json();
        document.getElementById(typingId).remove();
        if (data.success) {
          addMsg('ai', data.response, mode === 'agent' ? '🤖 Autonomous Agent' : '💬 AI Assistant');
          history.push({ role: 'assistant', content: data.response });
        } else {
          addMsg('ai', '⚠️ Error: ' + (data.error || 'Unknown error'));
        }
      } catch(e) {
        document.getElementById(typingId).remove();
        addMsg('ai', '⚠️ Network error: ' + e.message);
      }
      btn.disabled = false; btn.textContent = 'Send';
    }
    function addTypingIndicator() {
      const messages = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = 'msg ai';
      const id = 'typing-' + Date.now();
      div.id = id;
      div.innerHTML = '<div class="msg-label">AI is thinking...</div><div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      return id;
    }
    function addMsg(role, content, label) {
      const messages = document.getElementById('messages');
      // Remove welcome if present
      const welcome = messages.querySelector('.welcome');
      if (welcome) welcome.remove();
      const div = document.createElement('div');
      div.className = 'msg ' + role;
      const labelText = role === 'user' ? 'You' : (label || '💬 AI Assistant');
      div.innerHTML = '<div class="msg-label">' + labelText + '</div><div class="msg-bubble">' + formatContent(content) + '</div>';
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
    function formatContent(text) {
      return String(text)
        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\\n/g, '<br>');
    }
  </script>
</body>
</html>`;

  return res.status(200).send(html);
}
