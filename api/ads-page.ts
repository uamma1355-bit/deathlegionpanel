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
  <title>Death Legion — Watch Ads for Credits</title>
  <style>${DESIGN_SYSTEM_CSS}
    .ads-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:1rem; margin-bottom:2rem; }
    .ad-card { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.3rem; cursor:pointer; transition:var(--dl-transition); position:relative; overflow:hidden; }
    .ad-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, var(--dl-bronze), var(--dl-bronze-light)); opacity:0; transition:var(--dl-transition); }
    .ad-card:hover { border-color:rgba(188,110,60,0.4); transform:translateY(-4px); box-shadow:var(--dl-shadow); }
    .ad-card:hover::before { opacity:1; }
    .ad-card.watched { opacity:0.35; cursor:not-allowed; }
    .ad-card.watched:hover { transform:none; box-shadow:none; }
    .ad-card .ad-watched-tag { position:absolute; top:0.6rem; right:0.6rem; }
    .ad-cat { display:inline-block; padding:3px 10px; border-radius:10px; font-size:0.62rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.6rem; }
    .ad-cat.gaming { background:rgba(168,85,247,0.15); color:#a855f7; border:1px solid rgba(168,85,247,0.2); }
    .ad-cat.tech { background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.2); }
    .ad-cat.hosting { background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.2); }
    .ad-cat.crypto { background:rgba(234,179,8,0.15); color:#eab308; border:1px solid rgba(234,179,8,0.2); }
    .ad-cat.education { background:rgba(236,72,153,0.15); color:#ec4899; border:1px solid rgba(236,72,153,0.2); }
    .ad-cat.music { background:rgba(20,184,166,0.15); color:#14b8a6; border:1px solid rgba(20,184,166,0.2); }
    .ad-card .ad-title { font-size:0.95rem; font-weight:600; color:var(--dl-text); margin-bottom:0.4rem; line-height:1.3; }
    .ad-card .ad-reward { font-family:var(--dl-font-mono); color:var(--dl-bronze-light); font-size:0.9rem; font-weight:700; }
    .ad-card .ad-meta { display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; }
    .ad-card .ad-duration { color:var(--dl-text-dim); font-size:0.72rem; }
    .ad-card .play-btn { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); display:flex; align-items:center; justify-content:center; font-size:0.8rem; color:#fff; transition:var(--dl-transition); }
    .ad-card:hover .play-btn { transform:scale(1.1); box-shadow:0 0 12px rgba(188,110,60,0.4); }
    .info-bar { background:var(--dl-bg-card); border:1px solid var(--dl-border); border-radius:var(--dl-radius); padding:1rem 1.2rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.8rem; backdrop-filter:blur(12px); }
    .info-item { font-size:0.8rem; color:var(--dl-text-muted); }
    .info-item strong { color:var(--dl-bronze-light); font-family:var(--dl-font-mono); }

    /* Ad player */
    .ad-player { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.95); backdrop-filter:blur(8px); display:none; align-items:center; justify-content:center; flex-direction:column; padding:1.5rem; }
    .ad-player.active { display:flex; }
    .ad-frame { width:100%; max-width:600px; min-height:340px; background:linear-gradient(135deg, rgba(20,15,12,0.98), rgba(15,12,10,0.98)); border:1px solid rgba(188,110,60,0.3); border-radius:var(--dl-radius-xl); overflow:hidden; display:flex; align-items:center; justify-content:center; flex-direction:column; padding:2.5rem 2rem; text-align:center; box-shadow:var(--dl-shadow-lg), var(--dl-shadow-glow); }
    .ad-sponsor-tag { color:var(--dl-text-dim); font-size:0.65rem; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:1rem; }
    .ad-title-big { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:1.8rem; font-weight:900; margin-bottom:0.5rem; letter-spacing:0.03em; }
    .ad-desc { color:var(--dl-text-muted); font-size:0.88rem; margin-bottom:1.5rem; }
    .ad-link { display:inline-block; padding:0.7rem 1.8rem; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; border-radius:var(--dl-radius); text-decoration:none; font-weight:600; font-size:0.88rem; margin-bottom:1.5rem; transition:var(--dl-transition); }
    .ad-link:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(188,110,60,0.3); }
    .ad-timer { color:var(--dl-text-muted); font-size:0.8rem; font-family:var(--dl-font-mono); margin-top:0.5rem; }
    .ad-timer .count { color:var(--dl-bronze-light); font-weight:700; font-size:2.5rem; display:block; line-height:1; margin:0.3rem 0; }
    .ad-progress { width:100%; max-width:600px; height:4px; background:rgba(255,255,255,0.08); border-radius:2px; margin-top:1.2rem; overflow:hidden; }
    .ad-progress-bar { height:100%; background:linear-gradient(90deg, var(--dl-bronze), var(--dl-bronze-light)); width:0%; transition:width 1s linear; box-shadow:0 0 8px rgba(188,110,60,0.4); }
    .ad-skip { margin-top:1rem; color:var(--dl-text-dim); font-size:0.72rem; }
    .reward-screen { display:none; text-align:center; animation:dl-fade-in 0.5s ease-out; }
    .reward-screen.active { display:block; }
    .reward-screen h2 { font-family:var(--dl-font-display); font-size:1.8rem; color:var(--dl-green); margin-bottom:0.5rem; }
    .reward-screen .reward-num { font-family:var(--dl-font-mono); font-size:4rem; font-weight:700; color:var(--dl-green); margin:0.5rem 0; text-shadow:0 0 30px rgba(34,197,94,0.3); }
    .reward-screen .reward-msg { color:var(--dl-text-muted); font-size:0.88rem; margin-bottom:1.5rem; }
    .reward-actions { display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/ads')}
  <div class="dl-container">
    <div class="dl-hero">
      <h1>Watch Ads, Earn Credits</h1>
      <p>Watch a 15-second ad to earn <strong style="color:var(--dl-bronze-light)">50 credits</strong>. Up to 10 ads per day = 500 bonus credits.</p>
      <div class="dl-stat-row">
        <div class="dl-stat">
          <div class="dl-stat-num" id="currentCredits">---</div>
          <div class="dl-stat-label">Current Credits</div>
        </div>
        <div class="dl-stat">
          <div class="dl-stat-num" id="adsWatched">0</div>
          <div class="dl-stat-label">Ads Watched Today</div>
        </div>
        <div class="dl-stat">
          <div class="dl-stat-num" id="adsRemaining">10</div>
          <div class="dl-stat-label">Ads Remaining</div>
        </div>
      </div>
      <div class="dl-progress" style="max-width:400px;margin:0 auto;">
        <div class="dl-progress-fill" id="adsProgress" style="width:0%"></div>
      </div>
      <div style="color:var(--dl-text-dim);font-size:0.72rem;margin-top:0.5rem;">Daily ad limit: 10 ads = 500 credits</div>
    </div>

    <div class="info-bar">
      <div class="info-item">Reward per ad: <strong>50 credits</strong></div>
      <div class="info-item">Ad duration: <strong>15 seconds</strong></div>
      <div class="info-item">Daily limit: <strong>10 ads</strong></div>
      <a href="/credits" class="dl-btn dl-btn-outline">View Balance</a>
    </div>

    <h2 class="dl-section-title">Available Ads</h2>
    <div class="ads-grid" id="adsGrid">
      <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--dl-text-muted);">
        <span class="dl-spinner"></span> Loading ads...
      </div>
    </div>

    <div class="dl-empty" id="emptyState" style="display:none;">
      <div class="dl-empty-icon">🎉</div>
      <h3>All ads watched!</h3>
      <p>You've watched all 10 ads today. Come back tomorrow for more.</p>
      <p style="margin-top:0.5rem;color:var(--dl-text-dim);">Credits reset at midnight UTC.</p>
    </div>

    <div class="dl-footer">
      <p>Credits are used to start servers (5 credits per start). Watch ads to earn more anytime.</p>
      <p style="margin-top:0.3rem;"><a href="/">Back to Panel</a></p>
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
      <div class="reward-actions">
        <button class="dl-btn dl-btn-primary" onclick="closeAdPlayer();location.reload();">Watch Another</button>
        <button class="dl-btn dl-btn-ghost" onclick="closeAdPlayer()">Close</button>
      </div>
    </div>
  </div>

  <script>
    let username = 'guest';
    let adInfo = null;

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
        document.getElementById('adsGrid').innerHTML = '<div style="grid-column:1/-1;color:var(--dl-red);text-align:center;padding:2rem;">Failed to load ads: ' + e.message + '</div>';
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
      info.ads.forEach(function(ad, i) {
        const card = document.createElement('div');
        card.className = 'ad-card dl-fade-in';
        card.style.animationDelay = (i * 0.05) + 's';
        card.onclick = function() { playAd(ad); };
        card.innerHTML =
          '<div class="ad-cat ' + ad.category + '">' + ad.category + '</div>' +
          '<div class="ad-title">' + escapeHtml(ad.title) + '</div>' +
          '<div class="ad-reward">+50 credits</div>' +
          '<div class="ad-meta">' +
            '<span class="ad-duration">' + ad.duration + 's</span>' +
            '<div class="play-btn">▶</div>' +
          '</div>';
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
      document.getElementById('adTitleBig').textContent = ad.title;
      document.getElementById('adDesc').textContent = 'Sponsored by ' + ad.title + '. Click to learn more.';
      document.getElementById('adLink').href = ad.url;
      frame.style.display = 'flex';
      reward.classList.remove('active');
      let remaining = ad.duration || 15;
      document.getElementById('adCountdown').textContent = remaining;
      document.getElementById('adProgressBar').style.width = '0%';
      player.classList.add('active');
      const interval = setInterval(function() {
        remaining--;
        document.getElementById('adCountdown').textContent = remaining;
        document.getElementById('adProgressBar').style.width = ((ad.duration - remaining) / ad.duration * 100) + '%';
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
          document.getElementById('adFrame').style.display = 'none';
          document.getElementById('rewardScreen').classList.add('active');
          const msg = document.getElementById('rewardMsg');
          if (data.success) {
            msg.textContent = data.message || ('New balance: ' + (data.newBalance || 'N/A') + ' credits');
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

    loadAdInfo();
    loadCredits();
  </script>
</body>
</html>`;

  return res.status(200).send(html);
}
