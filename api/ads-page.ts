import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Ads Page — Dedicated page where users can watch ads to earn credits
 * URL: /ads
 *
 * Shows:
 * - Current credit balance + plan
 * - Ads watched today / remaining
 * - Grid of available ads (click to watch)
 * - Ad player with 15-second countdown
 * - Reward screen after watching
 */

const NAV_LOGO_URL = 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=120&h=120&fit=crop&q=80';

const ADS_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Watch Ads for Credits</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family:'Inter',sans-serif; background:#080808; color:#e5e5e5; min-height:100vh;
      background-image: linear-gradient(rgba(8,8,8,0.92), rgba(8,8,8,0.95)), url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80');
      background-size: cover; background-position: center; background-attachment: fixed;
    }
    .header { background:rgba(15,15,15,0.95); border-bottom:1px solid rgba(188,110,60,0.2); padding:0.8rem 1.5rem; display:flex; align-items:center; justify-content:space-between; backdrop-filter:blur(10px); position:sticky; top:0; z-index:100; }
    .logo-wrap { display:flex; align-items:center; gap:0.6rem; }
    .logo-img { width:32px; height:32px; border-radius:8px; object-fit:cover; border:1px solid rgba(188,110,60,0.4); box-shadow:0 0 10px rgba(188,110,60,0.3); }
    .logo { font-family:'Cinzel',serif; font-size:1.2rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c,#e89060); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; }
    .beta-badge { background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; padding:2px 8px; border-radius:10px; font-size:0.6rem; font-weight:700; text-transform:uppercase; margin-left:0.3rem; }
    .nav { display:flex; gap:0.4rem; }
    .nav a { padding:0.3rem 0.7rem; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:6px; color:#888; text-decoration:none; font-size:0.75rem; }
    .nav a:hover { color:#e89060; }
    .nav a.active { background:rgba(188,110,60,0.15); color:#e89060; border-color:rgba(188,110,60,0.3); }
    .container { max-width:1000px; margin:0 auto; padding:2rem 1.5rem; }
    .hero { background:rgba(20,15,12,0.9); border:1px solid rgba(188,110,60,0.2); border-radius:16px; padding:2rem; text-align:center; margin-bottom:1.5rem; backdrop-filter:blur(10px); }
    .hero h1 { font-family:'Cinzel',serif; font-size:1.8rem; font-weight:900; color:#e89060; margin-bottom:0.3rem; letter-spacing:0.05em; text-transform:uppercase; }
    .hero p { color:#888; font-size:0.9rem; margin-bottom:1.5rem; }
    .credit-display { display:flex; justify-content:center; gap:2rem; flex-wrap:wrap; margin-bottom:1.5rem; }
    .credit-stat { text-align:center; }
    .credit-stat .num { font-family:'JetBrains Mono',monospace; font-size:2.5rem; font-weight:700; background:linear-gradient(135deg,#bc6e3c,#e89060); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .credit-stat .label { color:#666; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; margin-top:0.2rem; }
    .progress-bar { width:100%; max-width:400px; height:8px; background:rgba(255,255,255,0.08); border-radius:4px; margin:1rem auto; overflow:hidden; }
    .progress-fill { height:100%; background:linear-gradient(90deg,#bc6e3c,#e89060); border-radius:4px; transition:width 0.5s; }
    .ads-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:1rem; margin-bottom:2rem; }
    .ad-card { background:rgba(20,20,20,0.9); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:1.2rem; cursor:pointer; transition:all 0.2s; position:relative; overflow:hidden; }
    .ad-card:hover { border-color:rgba(188,110,60,0.4); transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.4); }
    .ad-card.watched { opacity:0.4; cursor:not-allowed; }
    .ad-card.watched::after { content:'✓ Watched'; position:absolute; top:0.5rem; right:0.5rem; background:rgba(34,197,94,0.2); color:#22c55e; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:600; }
    .ad-card .ad-cat { display:inline-block; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:600; text-transform:uppercase; margin-bottom:0.5rem; }
    .ad-cat.gaming { background:rgba(168,85,247,0.2); color:#a855f7; }
    .ad-cat.tech { background:rgba(59,130,246,0.2); color:#3b82f6; }
    .ad-cat.hosting { background:rgba(34,197,94,0.2); color:#22c55e; }
    .ad-cat.crypto { background:rgba(234,179,8,0.2); color:#eab308; }
    .ad-cat.education { background:rgba(236,72,153,0.2); color:#ec4899; }
    .ad-cat.music { background:rgba(20,184,166,0.2); color:#14b8a6; }
    .ad-card .ad-title { font-size:0.95rem; font-weight:600; color:#e5e5e5; margin-bottom:0.3rem; }
    .ad-card .ad-reward { font-family:'JetBrains Mono',monospace; color:#e89060; font-size:0.85rem; font-weight:600; }
    .ad-card .ad-duration { color:#555; font-size:0.7rem; margin-top:0.2rem; }
    .ad-card .play-icon { font-size:1.5rem; margin-top:0.5rem; }
    .section-title { font-family:'Cinzel',serif; font-size:1.1rem; color:#e89060; margin-bottom:1rem; letter-spacing:0.05em; text-transform:uppercase; }
    .info-bar { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:1rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; }
    .info-bar .info-item { font-size:0.8rem; color:#888; }
    .info-bar .info-item strong { color:#e89060; }
    .btn { display:inline-block; padding:0.6rem 1.2rem; background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; border:none; border-radius:8px; font-weight:600; font-size:0.85rem; cursor:pointer; text-decoration:none; transition:all 0.2s; }
    .btn:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(188,110,60,0.3); }
    .btn-outline { background:transparent; border:1px solid rgba(188,110,60,0.3); color:#e89060; }
    .btn-outline:hover { background:rgba(188,110,60,0.1); }

    /* Ad player overlay */
    .ad-player { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.97); display:none; align-items:center; justify-content:center; flex-direction:column; padding:1rem; }
    .ad-player.active { display:flex; }
    .ad-player .ad-frame { width:100%; max-width:640px; min-height:360px; background:#111; border:1px solid rgba(188,110,60,0.3); border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center; flex-direction:column; padding:2rem; text-align:center; }
    .ad-player .ad-sponsor-tag { color:#666; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem; }
    .ad-player .ad-title-big { font-family:'Cinzel',serif; color:#e89060; font-size:1.8rem; font-weight:900; margin-bottom:0.5rem; }
    .ad-player .ad-desc { color:#aaa; font-size:0.9rem; margin-bottom:1.5rem; }
    .ad-player .ad-link { display:inline-block; padding:0.7rem 1.8rem; background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.9rem; margin-bottom:1.5rem; }
    .ad-player .ad-timer { color:#aaa; font-size:0.9rem; font-family:'JetBrains Mono',monospace; margin-top:0.5rem; }
    .ad-player .ad-timer .count { color:#e89060; font-weight:700; font-size:2rem; display:block; }
    .ad-player .ad-progress { width:100%; max-width:640px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:1rem; overflow:hidden; }
    .ad-player .ad-progress-bar { height:100%; background:linear-gradient(90deg,#bc6e3c,#e89060); width:0%; transition:width 1s linear; }
    .ad-player .ad-skip { margin-top:1rem; color:#555; font-size:0.75rem; }
    .ad-player .reward-screen { display:none; text-align:center; }
    .ad-player .reward-screen.active { display:block; }
    .ad-player .reward-screen h2 { font-family:'Cinzel',serif; font-size:2rem; color:#22c55e; margin-bottom:0.5rem; }
    .ad-player .reward-screen .reward-num { font-family:'JetBrains Mono',monospace; font-size:4rem; font-weight:700; color:#22c55e; margin:1rem 0; }
    .ad-player .reward-screen .reward-msg { color:#aaa; font-size:0.9rem; margin-bottom:1.5rem; }
    .footer { text-align:center; margin-top:2rem; color:#444; font-size:0.75rem; }
    .empty-state { text-align:center; padding:3rem 1rem; color:#666; }
    .empty-state .icon { font-size:3rem; margin-bottom:0.5rem; }
    .loading { text-align:center; padding:2rem; color:#666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-wrap">
      <img src="${NAV_LOGO_URL}" class="logo-img" alt="DL" />
      <div><span class="logo">Death Legion</span><span class="beta-badge">EARN CREDITS</span></div>
    </div>
    <div class="nav">
      <a href="/">Panel</a>
      <a href="/credits">Credits</a>
      <a href="/ads" class="active">Watch Ads</a>
      <a href="/ai-agent">Agent</a>
      <a href="/statistics">Stats</a>
    </div>
  </div>

  <div class="container">
    <div class="hero">
      <h1>Watch Ads, Earn Credits</h1>
      <p>Watch a 15-second ad to earn 50 credits. Up to 10 ads per day = 500 bonus credits.</p>
      <div class="credit-display">
        <div class="credit-stat">
          <div class="num" id="currentCredits">---</div>
          <div class="label">Current Credits</div>
        </div>
        <div class="credit-stat">
          <div class="num" id="adsWatched">0</div>
          <div class="label">Ads Watched Today</div>
        </div>
        <div class="credit-stat">
          <div class="num" id="adsRemaining">10</div>
          <div class="label">Ads Remaining</div>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="adsProgress" style="width:0%"></div>
      </div>
      <div style="color:#666;font-size:0.75rem;">Daily ad limit: 10 ads = 500 credits</div>
    </div>

    <div class="info-bar">
      <div class="info-item">Reward per ad: <strong>50 credits</strong></div>
      <div class="info-item">Ad duration: <strong>15 seconds</strong></div>
      <div class="info-item">Daily limit: <strong>10 ads</strong></div>
      <a href="/credits" class="btn btn-outline">View Credit Balance</a>
    </div>

    <h2 class="section-title">Available Ads</h2>
    <div class="ads-grid" id="adsGrid">
      <div class="loading">Loading ads...</div>
    </div>

    <div class="empty-state" id="emptyState" style="display:none;">
      <div class="icon">🎉</div>
      <h3 style="color:#e89060;margin-bottom:0.3rem;">All ads watched!</h3>
      <p>You've watched all 10 ads today. Come back tomorrow for more.</p>
      <p style="margin-top:0.5rem;">Credits reset at midnight UTC.</p>
    </div>

    <div class="footer">
      <p>Credits are used to start servers (5 credits per start). Watch ads to earn more anytime.</p>
      <p style="margin-top:0.3rem;">Death Legion Panel · <a href="/" style="color:#555;">Back to Panel</a></p>
    </div>
  </div>

  <!-- Ad player overlay -->
  <div class="ad-player" id="adPlayer">
    <div class="ad-frame" id="adFrame">
      <div class="ad-sponsor-tag">Advertisement</div>
      <div class="ad-title-big" id="adTitleBig">Ad Title</div>
      <div class="ad-desc" id="adDesc">Sponsored content</div>
      <a class="ad-link" id="adLink" href="#" target="_blank" rel="noopener">Learn More</a>
      <div class="ad-timer">
        Ad ends in
        <span class="count" id="adCountdown">15</span>
        seconds
      </div>
      <div class="ad-skip">You can close after the timer completes</div>
    </div>
    <div class="ad-progress">
      <div class="ad-progress-bar" id="adProgressBar"></div>
    </div>
    <div class="reward-screen" id="rewardScreen">
      <h2>Reward Earned!</h2>
      <div class="reward-num">+50</div>
      <div class="reward-msg" id="rewardMsg">Credits added to your account</div>
      <button class="btn" onclick="closeAdPlayer()">Continue</button>
      <div style="margin-top:1rem;">
        <button class="btn btn-outline" onclick="closeAdPlayer();location.reload();">Watch Another</button>
      </div>
    </div>
  </div>

  <script>
    let username = 'guest';
    let adInfo = null;
    let watchedAds = new Set();

    async function getUsername() {
      try {
        const r = await fetch('/api/client/account', { credentials:'include', headers:{'Accept':'application/json'} });
        if (!r.ok) return;
        const d = await r.json();
        if (d.attributes) username = d.attributes.username;
      } catch(e) {}
    }

    async function loadAdInfo() {
      await getUsername();
      try {
        const r = await fetch('/api/ads?action=info&user=' + encodeURIComponent(username));
        const d = await r.json();
        adInfo = d;
        renderAds(d);
      } catch(e) {
        document.getElementById('adsGrid').innerHTML = '<div class="loading" style="color:#ef4444;">Failed to load ads: ' + e.message + '</div>';
      }
    }

    async function loadCredits() {
      try {
        const r = await fetch('/api/credits?action=balance&user=' + encodeURIComponent(username));
        const d = await r.json();
        const el = document.getElementById('currentCredits');
        if (el) el.textContent = d.credits === 'Unlimited' ? '∞' : d.credits;
      } catch(e) {}
    }

    function renderAds(info) {
      const grid = document.getElementById('adsGrid');
      const empty = document.getElementById('emptyState');
      document.getElementById('adsWatched').textContent = info.adsWatchedToday;
      document.getElementById('adsRemaining').textContent = info.adsRemaining;
      document.getElementById('adsProgress').style.width = (info.adsWatchedToday / info.maxAdsPerDay * 100) + '%';

      if (info.adsRemaining === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
      }

      grid.style.display = 'grid';
      empty.style.display = 'none';
      grid.innerHTML = '';
      info.ads.forEach(function(ad) {
        const card = document.createElement('div');
        const isWatched = info.adsWatchedToday >= info.maxAdsPerDay;
        card.className = 'ad-card' + (isWatched ? ' watched' : '');
        card.onclick = function() {
          if (!isWatched) playAd(ad);
        };
        card.innerHTML =
          '<div class="ad-cat ' + ad.category + '">' + ad.category + '</div>' +
          '<div class="ad-title">' + escapeHtml(ad.title) + '</div>' +
          '<div class="ad-reward">+50 credits</div>' +
          '<div class="ad-duration">' + ad.duration + 's ad</div>' +
          '<div class="play-icon">▶</div>';
        grid.appendChild(card);
      });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    }

    function playAd(ad) {
      const player = document.getElementById('adPlayer');
      const frame = document.getElementById('adFrame');
      const reward = document.getElementById('rewardScreen');
      const titleEl = document.getElementById('adTitleBig');
      const descEl = document.getElementById('adDesc');
      const linkEl = document.getElementById('adLink');
      const countdownEl = document.getElementById('adCountdown');
      const progressEl = document.getElementById('adProgressBar');

      frame.style.display = 'flex';
      reward.classList.remove('active');
      titleEl.textContent = ad.title;
      descEl.textContent = 'Sponsored by ' + ad.title + '. Click to learn more.';
      linkEl.href = ad.url;

      let remaining = ad.duration || 15;
      countdownEl.textContent = remaining;
      progressEl.style.width = '0%';
      player.classList.add('active');

      const interval = setInterval(function() {
        remaining--;
        countdownEl.textContent = remaining;
        progressEl.style.width = ((ad.duration - remaining) / ad.duration * 100) + '%';
        if (remaining <= 0) {
          clearInterval(interval);
          claimReward(ad);
        }
      }, 1000);
    }

    function claimReward(ad) {
      fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: username, action: 'watch', adId: ad.id })
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          const frame = document.getElementById('adFrame');
          const reward = document.getElementById('rewardScreen');
          const msg = document.getElementById('rewardMsg');
          frame.style.display = 'none';
          reward.classList.add('active');
          if (data.success) {
            msg.textContent = data.message || ('+50 credits added. New balance: ' + (data.newBalance || 'N/A'));
          } else {
            msg.textContent = data.error || 'Failed to grant credits';
          }
          loadCredits();
        })
        .catch(function(e) {
          document.getElementById('rewardMsg').textContent = 'Error: ' + e.message;
          document.getElementById('adFrame').style.display = 'none';
          document.getElementById('rewardScreen').classList.add('active');
        });
    }

    function closeAdPlayer() {
      document.getElementById('adPlayer').classList.remove('active');
    }

    // Initial load
    loadAdInfo();
    loadCredits();
  </script>
</body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(ADS_PAGE);
}
