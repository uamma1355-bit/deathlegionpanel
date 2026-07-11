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
  <title>Death Legion — Credits</title>
  <style>${DESIGN_SYSTEM_CSS}
    .countdown-box { margin-top:1.2rem; padding:1rem 1.2rem; background:rgba(15,15,15,0.6); border:1px solid var(--dl-border); border-radius:var(--dl-radius); display:inline-block; }
    .countdown-label { color:var(--dl-text-dim); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; }
    .countdown-time { font-family:var(--dl-font-mono); font-size:1.4rem; color:var(--dl-bronze-light); margin-top:0.2rem; font-weight:600; }
    .plan-card { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.5rem; transition:var(--dl-transition); position:relative; overflow:hidden; }
    .plan-card:hover { border-color:var(--dl-border-hover); transform:translateY(-3px); box-shadow:var(--dl-shadow); }
    .plan-card.featured { border-color:rgba(188,110,60,0.3); box-shadow:var(--dl-shadow-glow); }
    .plan-card.featured::before { content:'POPULAR'; position:absolute; top:0.8rem; right:0.8rem; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; padding:2px 10px; border-radius:10px; font-size:0.6rem; font-weight:700; letter-spacing:0.05em; }
    .plan-card h3 { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:1.2rem; margin-bottom:0.5rem; letter-spacing:0.03em; }
    .plan-card .credits { font-family:var(--dl-font-mono); font-size:2rem; font-weight:700; color:var(--dl-text); margin-bottom:1rem; }
    .plan-card .credits .per { font-size:0.85rem; color:var(--dl-text-dim); font-weight:400; }
    .plan-card ul { list-style:none; padding:0; }
    .plan-card li { padding:0.35rem 0; color:var(--dl-text-muted); font-size:0.85rem; display:flex; align-items:center; gap:0.4rem; }
    .plan-card li::before { content:'✓'; color:var(--dl-green); font-weight:700; }
    .actions { display:flex; gap:0.6rem; justify-content:center; flex-wrap:wrap; margin-top:1.5rem; }
    .stat-card { background:var(--dl-bg-card); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.3rem; text-align:center; transition:var(--dl-transition); }
    .stat-card:hover { border-color:var(--dl-border-hover); transform:translateY(-2px); }
    .stat-card .icon { font-size:1.6rem; margin-bottom:0.3rem; }
    .stat-card .value { font-family:var(--dl-font-mono); font-size:1.5rem; font-weight:700; color:var(--dl-bronze-light); }
    .stat-card .label { color:var(--dl-text-dim); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; margin-top:0.2rem; }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/credits')}
  <div class="dl-container">
    <div class="dl-hero">
      <h1>Credits &amp; Plans</h1>
      <p>Credits are spent when you start servers and use AI features. They reset daily at midnight UTC.</p>
      <div class="dl-stat-row" style="margin-bottom:0;">
        <div class="dl-stat">
          <div class="dl-stat-num" id="creditAmount">---</div>
          <div class="dl-stat-label">Available Credits</div>
        </div>
      </div>
      <div style="margin-top:1rem;">
        <span id="planBadge" class="dl-pill dl-pill-bronze">Loading...</span>
      </div>
      <div class="countdown-box">
        <div class="countdown-label"><span class="dl-live-dot"></span> Next Credit Reset</div>
        <div class="countdown-time" id="countdown">--h --m --s</div>
      </div>
    </div>

    <h2 class="dl-section-title">Usage Statistics</h2>
    <div class="dl-grid dl-grid-4" style="margin-bottom:1.5rem;">
      <div class="stat-card">
        <div class="icon">📊</div>
        <div class="value" id="totalUsed">0</div>
        <div class="label">Total Used</div>
      </div>
      <div class="stat-card">
        <div class="icon">⚡</div>
        <div class="value" id="dailyLimit">100</div>
        <div class="label">Daily Limit</div>
      </div>
      <div class="stat-card">
        <div class="icon">🚀</div>
        <div class="value">5</div>
        <div class="label">Server Start</div>
      </div>
      <div class="stat-card">
        <div class="icon">📺</div>
        <div class="value">+50</div>
        <div class="label">Per Ad Watch</div>
      </div>
    </div>

    <h2 class="dl-section-title">Plans</h2>
    <div class="dl-grid dl-grid-cards" style="margin-bottom:1.5rem;">
      <div class="plan-card dl-fade-in" style="animation-delay:0s">
        <h3>Free</h3>
        <div class="credits">100<span class="per">/day</span></div>
        <ul>
          <li>2 Node.js servers</li>
          <li>1 Python server</li>
          <li>Basic AI assistant</li>
          <li>Community support</li>
        </ul>
      </div>
      <div class="plan-card featured dl-fade-in" style="animation-delay:0.1s">
        <h3>DL Member</h3>
        <div class="credits">200<span class="per">/day</span></div>
        <ul>
          <li>2 Node.js servers</li>
          <li>1 Python server</li>
          <li>Full AI assistant</li>
          <li>Priority support</li>
          <li>Advanced bot templates</li>
        </ul>
      </div>
      <div class="plan-card dl-fade-in" style="animation-delay:0.2s">
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
      <a href="/ads" class="dl-btn dl-btn-primary">📺 Watch Ads for Credits</a>
      <a href="/ai-assistant" class="dl-btn dl-btn-outline">Open AI Assistant</a>
      <a href="/ai-agent" class="dl-btn dl-btn-outline">Try Autonomous Agent</a>
      <a href="/legion-auth" class="dl-btn dl-btn-ghost">Upgrade to DL Member</a>
    </div>

    <div class="dl-footer">
      <p>Death Legion Panel &copy; 2026 — Credits reset daily at 00:00 UTC</p>
    </div>
  </div>
  <script>
    async function loadCredits() {
      try {
        const panelRes = await fetch('/api/client/account', { credentials:'include', headers:{'Accept':'application/json'} });
        let username = 'guest';
        if (panelRes.ok) {
          const panelData = await panelRes.json();
          username = panelData.attributes?.username || 'guest';
        }
        const res = await fetch('/api/credits?action=balance&user=' + username);
        if (res.ok) {
          const data = await res.json();
          document.getElementById('creditAmount').textContent = data.credits === 'Unlimited' ? '∞' : data.credits;
          document.getElementById('totalUsed').textContent = data.totalUsed;
          document.getElementById('dailyLimit').textContent = data.dailyLimit === 'Unlimited' ? '∞' : data.dailyLimit;
          const badge = document.getElementById('planBadge');
          badge.textContent = data.plan;
          badge.className = 'dl-pill ' + (data.plan === 'Admin' ? 'dl-pill-red' : data.plan === 'DL Member' ? 'dl-pill-bronze' : 'dl-pill-blue');
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

  return res.status(200).send(html);
}
