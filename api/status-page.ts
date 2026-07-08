import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_PANEL_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu';

function statusPageHtml(health: any): string {
  const isHealthy = health?.status === 'healthy';
  const panelStatus = health?.panel?.status || 'unknown';
  const apiStatus = health?.api?.status || 'unknown';
  const responseTime = health?.panel?.response_time_ms || 0;
  const healStatus = health?.self_heal?.status || 'unknown';
  const lastRun = health?.self_heal?.last_run || 'never';
  const timestamp = new Date().toISOString();

  const overallColor = isHealthy ? '#22c55e' : '#f59e0b';
  const overallText = isHealthy ? 'All Systems Operational' : 'Degraded Performance';
  const panelColor = panelStatus === 'healthy' ? '#22c55e' : '#ef4444';
  const apiColor = apiStatus === 'healthy' ? '#22c55e' : '#ef4444';
  const healColor = healStatus === 'completed' ? '#22c55e' : '#f59e0b';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Death Legion — System Status</title>
  <meta http-equiv="refresh" content="30">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0a0a0a;
      background-image: radial-gradient(ellipse at top, #1a1208 0%, #0a0a0a 60%);
      color: #e5e5e5;
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 3rem; }
    .logo {
      font-family: 'Cinzel', serif;
      font-size: 2.5rem;
      font-weight: 900;
      background: linear-gradient(135deg, #bc6e3c 0%, #e89060 50%, #bc6e3c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .subtitle { color: #888; margin-top: 0.5rem; font-size: 0.9rem; }
    .overall {
      text-align: center;
      padding: 2rem;
      background: rgba(20, 20, 20, 0.8);
      border: 1px solid ${overallColor}40;
      border-radius: 16px;
      margin-bottom: 2rem;
    }
    .overall-status {
      font-size: 1.8rem;
      font-weight: 700;
      color: ${overallColor};
      font-family: 'Cinzel', serif;
    }
    .overall-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }
    .overall-time { color: #666; font-size: 0.85rem; margin-top: 0.5rem; }
    .services { display: grid; gap: 1rem; }
    .service {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.2rem 1.5rem;
      background: rgba(20, 20, 20, 0.8);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
    }
    .service-info { display: flex; align-items: center; gap: 1rem; }
    .service-dot {
      width: 12px; height: 12px;
      border-radius: 50%;
      background: ${overallColor};
      box-shadow: 0 0 12px ${overallColor}80;
    }
    .service-name { font-weight: 600; font-size: 1rem; }
    .service-desc { color: #888; font-size: 0.85rem; margin-top: 0.2rem; }
    .service-status { font-size: 0.9rem; font-weight: 600; }
    .service-time { color: #666; font-size: 0.8rem; }
    .footer {
      text-align: center;
      margin-top: 3rem;
      color: #555;
      font-size: 0.8rem;
    }
    .footer a { color: #bc6e3c; text-decoration: none; }
    .pulse { animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Death Legion</div>
      <div class="subtitle">System Status</div>
    </div>

    <div class="overall">
      <div class="overall-icon">${isHealthy ? '&#10003;' : '&#9888;'}</div>
      <div class="overall-status">${overallText}</div>
      <div class="overall-time">Last updated: ${timestamp} (auto-refresh 30s)</div>
    </div>

    <div class="services">
      <div class="service">
        <div class="service-info">
          <div class="service-dot pulse" style="background:${panelColor};box-shadow:0 0 12px ${panelColor}80"></div>
          <div>
            <div class="service-name">Panel</div>
            <div class="service-desc">Pterodactyl web interface</div>
          </div>
        </div>
        <div>
          <div class="service-status" style="color:${panelColor}">${panelStatus === 'healthy' ? 'Operational' : 'Down'}</div>
          <div class="service-time">${responseTime}ms</div>
        </div>
      </div>

      <div class="service">
        <div class="service-info">
          <div class="service-dot pulse" style="background:${apiColor};box-shadow:0 0 12px ${apiColor}80"></div>
          <div>
            <div class="service-name">API</div>
            <div class="service-desc">Client + Application API</div>
          </div>
        </div>
        <div>
          <div class="service-status" style="color:${apiColor}">${apiStatus === 'healthy' ? 'Operational' : 'Down'}</div>
        </div>
      </div>

      <div class="service">
        <div class="service-info">
          <div class="service-dot pulse" style="background:${healColor};box-shadow:0 0 12px ${healColor}80"></div>
          <div>
            <div class="service-name">Self-Healing</div>
            <div class="service-desc">GitHub Actions auto-recovery</div>
          </div>
        </div>
        <div>
          <div class="service-status" style="color:${healColor}">${healStatus}</div>
          <div class="service-time">Last: ${lastRun ? new Date(lastRun).toLocaleString() : 'never'}</div>
        </div>
      </div>

      <div class="service">
        <div class="service-info">
          <div class="service-dot pulse" style="background:#22c55e;box-shadow:0 0 12px #22c55e80"></div>
          <div>
            <div class="service-name">Vercel Proxy</div>
            <div class="service-desc">Frontend + API proxy</div>
          </div>
        </div>
        <div>
          <div class="service-status" style="color:#22c55e">Operational</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Death Legion Panel &copy; 2026 | <a href="/">Go to Panel</a> | <a href="/apply">Apply</a></p>
      <p style="margin-top:0.5rem">Self-heal runs every 5 minutes via GitHub Actions</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Fetch health data
  let health = null;
  try {
    const resp = await fetch('https://deathlegionpanel.vercel.app/api/health', {
      signal: AbortSignal.timeout(8000),
    });
    health = await resp.json();
  } catch {
    health = { status: 'unhealthy', panel: { status: 'down' }, api: { status: 'down' } };
  }

  return res.status(200).send(statusPageHtml(health));
}
