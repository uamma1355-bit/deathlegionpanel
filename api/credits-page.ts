import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Credits Page — Beautiful credit system dashboard
 * Shows: current credits, plan, daily countdown, usage history, AI assistant link
 * Background: credit-bg.png
 */

const CREDITS_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Credits</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family:'Inter',sans-serif; background:#080808; color:#e5e5e5; min-height:100vh;
      background-image: linear-gradient(rgba(8,8,8,0.92), rgba(8,8,8,0.95)), url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80');
      background-size: cover; background-position: center; background-attachment: fixed;
    }
    .container { max-width:900px; margin:0 auto; padding:2rem 1.5rem; }
    .header { text-align:center; margin-bottom:2rem; }
    .logo { font-family:'Cinzel',serif; font-size:2rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c,#e89060); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; }
    .beta-badge { display:inline-block; background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; padding:3px 10px; border-radius:12px; font-size:0.65rem; font-weight:700; text-transform:uppercase; margin-left:0.5rem; vertical-align:middle; }
    .subtitle { color:#666; font-size:0.9rem; margin-top:0.3rem; }
    .nav { display:flex; gap:0.5rem; justify-content:center; margin-bottom:2rem; flex-wrap:wrap; }
    .nav a { padding:0.4rem 1rem; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:8px; color:#888; text-decoration:none; font-size:0.82rem; transition:all 0.2s; }
    .nav a:hover { border-color:rgba(188,110,60,0.3); color:#e89060; }
    .nav a.active { background:rgba(188,110,60,0.15); border-color:rgba(188,110,60,0.4); color:#e89060; }
    .credit-hero { background:rgba(20,20,20,0.9); border:1px solid rgba(188,110,60,0.2); border-radius:20px; padding:2rem; text-align:center; margin-bottom:1.5rem; }
    .credit-amount { font-family:'JetBrains Mono',monospace; font-size:3.5rem; font-weight:700; background:linear-gradient(135deg,#bc6e3c,#e89060); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .credit-label { color:#666; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.1em; margin-top:0.3rem; }
    .plan-badge { display:inline-block; padding:0.3rem 1rem; border-radius:20px; font-size:0.8rem; font-weight:600; margin-top:0.5rem; }
    .plan-free { background:rgba(100,100,100,0.2); color:#aaa; }
    .plan-dl { background:rgba(188,110,60,0.2); color:#e89060; }
    .plan-admin { background:rgba(239,68,68,0.2); color:#ef4444; }
    .countdown { margin-top:1rem; padding:0.8rem; background:rgba(15,15,15,0.8); border-radius:10px; }
    .countdown-label { color:#666; font-size:0.75rem; text-transform:uppercase; }
    .countdown-time { font-family:'JetBrains Mono',monospace; font-size:1.3rem; color:#e89060; margin-top:0.2rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:1rem; margin-bottom:1.5rem; }
    .card { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:1.2rem; text-align:center; }
    .card .icon { font-size:1.5rem; margin-bottom:0.3rem; }
    .card .value { font-family:'JetBrains Mono',monospace; font-size:1.3rem; font-weight:700; color:#e89060; }
    .card .label { color:#666; font-size:0.75rem; text-transform:uppercase; margin-top:0.2rem; }
    .plans { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; margin-bottom:1.5rem; }
    .plan-card { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:1.5rem; }
    .plan-card h3 { font-family:'Cinzel',serif; color:#e89060; font-size:1.1rem; margin-bottom:0.5rem; }
    .plan-card .credits { font-size:1.8rem; font-weight:700; color:#fff; margin-bottom:0.5rem; }
    .plan-card ul { list-style:none; padding:0; }
    .plan-card li { padding:0.2rem 0; color:#888; font-size:0.85rem; }
    .plan-card li::before { content:'✓ '; color:#22c55e; }
    .plan-card.featured { border-color:rgba(188,110,60,0.3); }
    .actions { display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; }
    .btn { display:inline-block; padding:0.7rem 1.5rem; border-radius:10px; text-decoration:none; font-weight:600; font-size:0.9rem; transition:all 0.2s; }
    .btn-primary { background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; }
    .btn-primary:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(188,110,60,0.3); }
    .btn-outline { background:transparent; border:1px solid rgba(188,110,60,0.3); color:#e89060; }
    .footer { text-align:center; margin-top:2rem; color:#444; font-size:0.75rem; }
    .footer a { color:#bc6e3c; text-decoration:none; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .live-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; animation:pulse 1.5s ease-in-out infinite; margin-right:0.3rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Death Legion <span class="beta-badge">BETA</span></div>
      <div class="subtitle">Credit System &amp; Plans</div>
    </div>
    <div class="nav">
      <a href="/">Panel</a>
      <a href="/credits" class="active">Credits</a>
      <a href="/ai-assistant">AI Assistant</a>
      <a href="/ai-agent">AI Agent</a>
      <a href="/statistics">Statistics</a>
      <a href="/status">Status</a>
    </div>

    <div class="credit-hero">
      <div class="credit-amount" id="creditAmount">---<span style="font-size:1.5rem;color:#666"> cr</span></div>
      <div class="credit-label">Available Credits</div>
      <div id="planBadge" class="plan-badge plan-free">Loading...</div>
      <div class="countdown">
        <div class="countdown-label"><span class="live-dot"></span> Next Credit Reset</div>
        <div class="countdown-time" id="countdown">--h --m --s</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="icon">📊</div>
        <div class="value" id="totalUsed">0</div>
        <div class="label">Total Used</div>
      </div>
      <div class="card">
        <div class="icon">⚡</div>
        <div class="value" id="dailyLimit">100</div>
        <div class="label">Daily Limit</div>
      </div>
      <div class="card">
        <div class="icon">🤖</div>
        <div class="value">10</div>
        <div class="label">AI Cost/Query</div>
      </div>
      <div class="card">
        <div class="icon">🚀</div>
        <div class="value">5</div>
        <div class="label">Server Start Cost</div>
      </div>
    </div>

    <div class="plans">
      <div class="plan-card">
        <h3>Free</h3>
        <div class="credits">100/day</div>
        <ul>
          <li>2 Node.js servers</li>
          <li>1 Python server</li>
          <li>Basic AI assistant</li>
          <li>Community support</li>
        </ul>
      </div>
      <div class="plan-card featured">
        <h3>DL Member</h3>
        <div class="credits">200/day</div>
        <ul>
          <li>2 Node.js servers</li>
          <li>1 Python server</li>
          <li>Full AI assistant</li>
          <li>Priority support</li>
          <li>Advanced bot templates</li>
        </ul>
      </div>
      <div class="plan-card">
        <h3>Admin</h3>
        <div class="credits">∞</div>
        <ul>
          <li>Unlimited servers</li>
          <li>Full AI access</li>
          <li>Autonomous AI agent</li>
          <li>Admin panel access</li>
          <li>All features unlocked</li>
        </ul>
      </div>
    </div>

    <div class="actions">
      <a href="/ai-assistant" class="btn btn-primary">Open AI Assistant</a>
      <a href="/ai-agent" class="btn btn-outline">Try Autonomous Agent (BETA)</a>
      <a href="/legion-auth" class="btn btn-outline">Upgrade to DL Member</a>
    </div>

    <div class="footer">
      <p>Death Legion Panel &copy; 2026 — Credits reset daily at 00:00 UTC</p>
      <p><a href="/">Panel</a> | <a href="/apply">Apply</a> | <a href="/status">Status</a></p>
    </div>
  </div>
  <script>
    // Fetch credit balance
    async function loadCredits() {
      try {
        // Try to get username from panel session
        const panelRes = await fetch('/api/client/account', { credentials:'include', headers:{'Accept':'application/json'} });
        let username = 'guest';
        if (panelRes.ok) {
          const panelData = await panelRes.json();
          username = panelData.attributes?.username || 'guest';
        }
        const res = await fetch('/api/credits?action=balance&user=' + username);
        if (res.ok) {
          const data = await res.json();
          document.getElementById('creditAmount').innerHTML = (data.credits === 'Unlimited' ? '∞' : data.credits) + '<span style="font-size:1.5rem;color:#666"> cr</span>';
          document.getElementById('totalUsed').textContent = data.totalUsed;
          document.getElementById('dailyLimit').textContent = data.dailyLimit === 'Unlimited' ? '∞' : data.dailyLimit;
          const badge = document.getElementById('planBadge');
          badge.textContent = data.plan;
          badge.className = 'plan-badge ' + (data.plan === 'Admin' ? 'plan-admin' : data.plan === 'DL Member' ? 'plan-dl' : 'plan-free');
          // Start countdown
          startCountdown(data.resetAt);
        }
      } catch(e) { console.log('Credit load error:', e); }
    }

    function startCountdown(resetAt) {
      const target = new Date(resetAt).getTime();
      function update() {
        const now = Date.now();
        const diff = target - now;
        if (diff <= 0) {
          document.getElementById('countdown').textContent = 'Resetting...';
          setTimeout(loadCredits, 2000);
          return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        document.getElementById('countdown').textContent = h + 'h ' + m + 'm ' + s + 's';
      }
      update();
      setInterval(update, 1000);
    }

    loadCredits();
  </script>
</body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(CREDITS_PAGE);
}
