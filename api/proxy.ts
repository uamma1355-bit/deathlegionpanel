import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_PANEL_URL = 'https://8000-16551277-c744-47d8-bbf4-f681442b1691.daytonaproxy01.eu';
const DAYTONA_HOST = '8000-16551277-c744-47d8-bbf4-f681442b1691.daytonaproxy01.eu';

// Curated image pools (direct Unsplash CDN URLs — always reachable)
const LOGIN_BG_IMAGE = 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1920&q=80&auto=format';
const NAV_LOGO_URL = 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=120&h=120&fit=crop&q=80';
const SERVER_BANNER_IMAGES = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=600&q=80',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80',
  'https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=600&q=80',
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80',
  'https://images.unsplash.com/photo-1556438064-2d7646166914?w=600&q=80',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80',
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&q=80',
  'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&q=80',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80',
  'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&q=80',
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&q=80',
  'https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=600&q=80',
  'https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=600&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
  'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=600&q=80',
  'https://images.unsplash.com/photo-1527185475247-e9bcd1f4d4a4?w=600&q=80',
];

function buildTargetUrl(req: VercelRequest): string {
  return DAYTONA_PANEL_URL + (req.url || '/');
}

function rewriteCookie(cookieStr: string, vercelHost: string): string {
  return cookieStr
    .replace(/domain=\.?daytonaproxy01\.eu[^;]*/gi, `domain=.${vercelHost}`)
    .replace(/domain=\.?localhost[^;]*/gi, `domain=.${vercelHost}`);
}

function rewriteBody(body: string, vercelHost: string): string {
  return body
    .replace(new RegExp('https?://8000-16551277-c744-47d8-bbf4-f681442b1691\\.daytonaproxy01\\.eu(?::443|:8000)?', 'g'), `https://${vercelHost}`)
    .replace(new RegExp('8000-16551277-c744-47d8-bbf4-f681442b1691\\.daytonaproxy01\\.eu', 'g'), vercelHost)
    .replace(new RegExp('wss?://8000-16551277-c744-47d8-bbf4-f681442b1691\\.daytonaproxy01\\.eu(?::443)?', 'g'), (match) => {
      return match.startsWith('wss') ? `wss://${vercelHost}` : `ws://${vercelHost}`;
    });
}

function shouldRewriteBody(contentType: string): boolean {
  return /text\/html|application\/json|application\/javascript|text\/javascript|text\/css|application\/xml|text\/xml/i.test(contentType);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const vercelHost = req.headers['host'] || 'deathlegionpanel.vercel.app';
  const targetUrl = buildTargetUrl(req);
  const method = req.method || 'GET';

  const forwardHeaders: Record<string, string> = {
    'Accept': req.headers['accept'] || '*/*',
    'Accept-Encoding': 'identity',
    'Accept-Language': req.headers['accept-language'] || '',
    'User-Agent': 'VercelProxy/1.0 (Serverless; +https://vercel.com)',
    'X-Forwarded-For': (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
    'X-Forwarded-Proto': 'https',
    'X-Forwarded-Host': vercelHost,
    'X-Real-IP': (req.headers['x-real-ip'] as string) || req.socket.remoteAddress || '',
    'Origin': DAYTONA_PANEL_URL,
  };

  if (req.headers['authorization']) forwardHeaders['Authorization'] = req.headers['authorization'] as string;
  if (req.headers['content-type']) forwardHeaders['Content-Type'] = req.headers['content-type'] as string;
  if (req.headers['x-xsrf-token']) forwardHeaders['X-XSRF-TOKEN'] = req.headers['x-xsrf-token'] as string;
  if (req.headers['x-requested-with']) forwardHeaders['X-Requested-With'] = req.headers['x-requested-with'] as string;
  if (req.headers['referer']) {
    forwardHeaders['Referer'] = (req.headers['referer'] as string).replace(
      new RegExp('https?://' + vercelHost.replace(/\./g, '\\.'), 'g'),
      DAYTONA_PANEL_URL
    );
  }
  if (req.headers['cookie']) forwardHeaders['Cookie'] = req.headers['cookie'] as string;

  let body: Buffer | undefined;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length > 0) {
      body = Buffer.concat(chunks);
      forwardHeaders['Content-Length'] = body.length.toString();
    }
  }

  // === Credit check: intercept server power-on requests ===
  // POST /api/client/servers/{id}/power with {"signal":"start"} costs 5 credits
  const reqUrl = req.url || '';
  const isPowerOn = method === 'POST' && /\/api\/client\/servers\/[^/]+\/power/.test(reqUrl) && body;
  if (isPowerOn) {
    try {
      const bodyText = body!.toString('utf8');
      const parsed = JSON.parse(bodyText);
      if (parsed.signal === 'start') {
        // Get the username from the account API (using the same cookies)
        const accountResp = await fetch(`https://${vercelHost}/api/client/account`, {
          headers: {
            'Accept': 'application/json',
            'Cookie': req.headers['cookie'] || '',
            'X-XSRF-TOKEN': (req.headers['x-xsrf-token'] as string) || '',
          },
        });
        if (accountResp.ok) {
          const accountData = await accountResp.json();
          const username = accountData?.attributes?.username || 'guest';

          // Check credit balance
          const balanceResp = await fetch(`https://${vercelHost}/api/credits?action=balance&user=${encodeURIComponent(username)}`);
          if (balanceResp.ok) {
            const balanceData = await balanceResp.json();
            const credits = typeof balanceData.credits === 'number' ? balanceData.credits : 999999;
            const plan = balanceData.plan || 'Free';
            const START_COST = 5;

            if (plan !== 'Admin' && credits < START_COST) {
              // Insufficient credits — return error with special code for the UI modal
              return res.status(403).json({
                errors: [{
                  code: 'InsufficientCredits',
                  status: '403',
                  detail: 'Insufficient credits to start server',
                  meta: {
                    credits: credits,
                    needed: START_COST,
                    plan: plan,
                    resetAt: balanceData.resetAt,
                    resetIn: balanceData.resetIn,
                    canWatchAd: true,
                    adReward: 50,
                  },
                }],
              });
            }

            // Deduct credits
            if (plan !== 'Admin') {
              await fetch(`https://${vercelHost}/api/credits?action=spend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: username, amount: START_COST }),
              });
            }
          }
        }
      }
    } catch (creditErr) {
      // If credit check fails, log but don't block the request
      console.error('Credit check error (non-blocking):', creditErr instanceof Error ? creditErr.message : creditErr);
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const resp = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: body,
      redirect: 'manual',
    });
    clearTimeout(timeout);

    res.status(resp.status);

    const respHeaders = resp.headers;
    const cookiesToSet: string[] = [];

    respHeaders.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'transfer-encoding' || lowerKey === 'content-encoding' || lowerKey === 'content-length') return;
      if (lowerKey === 'set-cookie') return;
      if (lowerKey === 'location') {
        const rewritten = value.replace(
          new RegExp('https?://8000-16551277-c744-47d8-bbf4-f681442b1691\\.daytonaproxy01\\.eu(?::443|:8000)?', 'g'),
          `https://${vercelHost}`
        );
        res.setHeader('Location', rewritten);
        return;
      }
      if (lowerKey === 'x-frame-options' || lowerKey === 'content-security-policy') return;
      res.setHeader(key, value);
    });

    const setCookies = respHeaders.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      cookiesToSet.push(rewriteCookie(cookie, vercelHost));
    }
    if (cookiesToSet.length > 0) {
      res.setHeader('Set-Cookie', cookiesToSet);
    }

    res.setHeader('Access-Control-Allow-Origin', `https://${vercelHost}`);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const contentType = respHeaders.get('content-type') || '';
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (shouldRewriteBody(contentType)) {
      let bodyStr = buffer.toString('utf8');

      // For websocket token responses: rewrite 127.0.0.1:808X to Daytona public URL
      // The Panel uses fqdn=127.0.0.1 for internal Wings communication,
      // but the browser needs the Daytona public URL for WebSocket connections.
      const isWebsocketResponse = (req.url || '').includes('/websocket') || bodyStr.includes('"socket"');
      if (isWebsocketResponse) {
        // Rewrite ws://127.0.0.1:PORT and http://127.0.0.1:PORT to wss://DAYTONA_URL:443
        bodyStr = bodyStr.replace(
          /wss?:\\*\/\\*\/127\.0\.0\.1:\d+/g,
          `wss://${DAYTONA_HOST}:443`
        );
        bodyStr = bodyStr.replace(
          /https?:\\*\/\\*\/127\.0\.0\.1:\d+/g,
          `https://${DAYTONA_HOST}:443`
        );
      } else {
        bodyStr = rewriteBody(bodyStr, vercelHost);
      }

      // Inject WebSocket interceptor + Legion Auth button + BETA badge
      if (contentType.includes('text/html') && !bodyStr.includes('__WS_INTERCEPTOR_INJECTED__')) {
        const wingsHostB64 = Buffer.from(DAYTONA_HOST).toString('base64');
        const interceptor = '\n<script id="__WS_INTERCEPTOR_INJECTED__">\n(function() {\n  var WINGS_HOST = atob(\'' + wingsHostB64 + '\');\n  var OrigWebSocket = window.WebSocket;\n  function PatchedWebSocket(url, protocols) {\n    if (url && url.charAt(0) === \'/\') { url = \'wss://\' + WINGS_HOST + url; }\n    return protocols ? new OrigWebSocket(url, protocols) : new OrigWebSocket(url);\n  }\n  PatchedWebSocket.prototype = OrigWebSocket.prototype;\n  PatchedWebSocket.CONNECTING = OrigWebSocket.CONNECTING;\n  PatchedWebSocket.OPEN = OrigWebSocket.OPEN;\n  PatchedWebSocket.CLOSING = OrigWebSocket.CLOSING;\n  PatchedWebSocket.CLOSED = OrigWebSocket.CLOSED;\n  window.WebSocket = PatchedWebSocket;\n})();\n</script>';
        if (bodyStr.includes('</head>')) {
          bodyStr = bodyStr.replace('</head>', interceptor + '\n</head>');
        }

        // Inject BETA badge + Legion Auth button + Nav icons + Background on ALL pages
        if (!bodyStr.includes('__LEGION_INJECT__')) {
          const legionInjection = `
<style id="__LEGION_INJECT__">
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;600;700&display=swap');

/* Background image on all panel pages */
body {
  background-image: linear-gradient(rgba(8,8,8,0.85), rgba(8,8,8,0.9)), url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80') !important;
  background-size: cover !important;
  background-position: center !important;
  background-attachment: fixed !important;
}

/* Login page special background */
body.dl-login-page {
  background-image: linear-gradient(135deg, rgba(20,8,4,0.7) 0%, rgba(8,4,12,0.85) 100%), url('${LOGIN_BG_IMAGE}') !important;
  background-size: cover !important;
  background-position: center !important;
  background-attachment: fixed !important;
}
body.dl-login-page .AuthFormCard,
body.dl-login-page form,
body.dl-login-page [class*="auth"],
body.dl-login-page [class*="Auth"],
body.dl-login-page [class*="login"],
body.dl-login-page [class*="Login"] {
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  background: rgba(15,12,10,0.78) !important;
  border: 1px solid rgba(188,110,60,0.3) !important;
  box-shadow: 0 12px 40px rgba(0,0,0,0.65), 0 0 80px rgba(188,110,60,0.12) !important;
  border-radius: 12px !important;
}
body.dl-login-page input[type="text"],
body.dl-login-page input[type="password"],
body.dl-login-page input[type="email"] {
  background: rgba(8,8,8,0.6) !important;
  border: 1px solid rgba(188,110,60,0.2) !important;
}
body.dl-login-page input[type="text"]:focus,
body.dl-login-page input[type="password"]:focus,
body.dl-login-page input[type="email"]:focus {
  border-color: rgba(188,110,60,0.6) !important;
  box-shadow: 0 0 0 3px rgba(188,110,60,0.15) !important;
}

/* BETA badge */
.dl-beta-badge {
  position: fixed; top: 12px; right: 12px; z-index: 99999;
  background: linear-gradient(135deg, #bc6e3c, #e89060);
  color: #fff; padding: 4px 12px; border-radius: 20px;
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase; font-family: 'Inter', sans-serif;
  box-shadow: 0 2px 10px rgba(188,110,60,0.3);
  pointer-events: none;
}

/* Death Legion branding watermark */
.dl-brand {
  position: fixed; bottom: 12px; left: 12px; z-index: 99999;
  font-family: 'Cinzel', serif; font-size: 0.75rem; font-weight: 700;
  color: rgba(188,110,60,0.4); letter-spacing: 0.1em;
  text-transform: uppercase; pointer-events: none;
}

/* Floating nav icons */
.dl-nav-icons {
  position: fixed; top: 12px; left: 12px; z-index: 99999;
  display: flex; gap: 6px; align-items: center;
}
.dl-nav-icon {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 10px;
  background: rgba(20,20,20,0.9); border: 1px solid rgba(188,110,60,0.15);
  color: #888; font-size: 1rem; text-decoration: none;
  transition: all 0.2s; cursor: pointer; position: relative;
}
.dl-nav-icon:hover {
  background: rgba(188,110,60,0.15); border-color: rgba(188,110,60,0.3);
  color: #e89060; transform: translateY(-1px);
}
.dl-nav-icon svg { width: 18px; height: 18px; fill: currentColor; }
.dl-nav-icon .tooltip {
  position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%);
  background: rgba(15,15,15,0.95); color: #e89060; padding: 2px 8px;
  border-radius: 4px; font-size: 0.65rem; white-space: nowrap;
  font-family: 'Inter', sans-serif; opacity: 0; transition: opacity 0.2s;
  pointer-events: none;
}
.dl-nav-icon:hover .tooltip { opacity: 1; }
.dl-nav-icon.active { background: rgba(188,110,60,0.2); border-color: rgba(188,110,60,0.4); color: #e89060; }

/* Legion Auth button on login page */
.dl-legion-auth-btn {
  display: block; width: 100%; margin-top: 1rem; padding: 0.75rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(188,110,60,0.3); border-radius: 8px;
  color: #e89060; font-size: 0.9rem; font-weight: 600;
  text-align: center; cursor: pointer; transition: all 0.2s;
  text-decoration: none; font-family: 'Inter', sans-serif;
}
.dl-legion-auth-btn:hover {
  transform: translateY(-1px); box-shadow: 0 4px 15px rgba(188,110,60,0.2);
  border-color: rgba(188,110,60,0.5);
}
.dl-legion-divider {
  display: flex; align-items: center; margin: 1rem 0;
  color: #555; font-size: 0.8rem;
}
.dl-legion-divider::before, .dl-legion-divider::after {
  content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08);
}
.dl-legion-divider span { padding: 0 0.75rem; }

/* Credit badge in nav */
.dl-credit-badge {
  display: flex; align-items: center; gap: 4px;
  background: rgba(20,20,20,0.9); border: 1px solid rgba(188,110,60,0.15);
  border-radius: 10px; padding: 4px 10px; font-size: 0.75rem;
  font-family: 'Inter', sans-serif; color: #e89060; font-weight: 600;
}
.dl-credit-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }

/* Nav bar logo image */
.dl-nav-logo {
  width: 36px; height: 36px; border-radius: 10px;
  object-fit: cover;
  border: 1px solid rgba(188,110,60,0.4);
  box-shadow: 0 0 12px rgba(188,110,60,0.3);
  transition: all 0.2s;
  margin-right: 4px;
  animation: dlLogoPulse 3s ease-in-out infinite;
  cursor: pointer;
}
@keyframes dlLogoPulse {
  0%, 100% { box-shadow: 0 0 10px rgba(188,110,60,0.3); }
  50% { box-shadow: 0 0 18px rgba(188,110,60,0.55); }
}
.dl-nav-logo:hover {
  transform: scale(1.1) rotate(-4deg);
  border-color: rgba(188,110,60,0.8);
}

/* Server card randomized banner images */
.dl-server-banner {
  height: 72px;
  width: 100%;
  background-size: cover !important;
  background-position: center !important;
  position: relative;
  border-radius: 6px;
  margin-bottom: 10px;
  overflow: hidden;
  border: 1px solid rgba(188,110,60,0.15);
  transition: all 0.3s;
}
.dl-server-banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(15,15,15,0.15) 0%, rgba(15,15,15,0.55) 100%);
  border-radius: 6px;
  pointer-events: none;
}
.dl-server-banner::before {
  content: 'DL';
  position: absolute;
  top: 6px; right: 8px;
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  font-weight: 900;
  color: rgba(232,144,96,0.85);
  letter-spacing: 0.1em;
  z-index: 2;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
}
/* When applied directly on a server-card <a> (background-image mode) */
a[data-dl-banner="1"] {
  background-size: cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  border: 1px solid rgba(188,110,60,0.18) !important;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s !important;
}
a[data-dl-banner="1"]:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 0 22px rgba(188,110,60,0.18);
  border-color: rgba(188,110,60,0.55) !important;
}
.dl-card-badge {
  position: absolute;
  top: 8px; left: 10px;
  z-index: 5;
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  font-weight: 900;
  color: rgba(232,144,96,0.85);
  letter-spacing: 0.12em;
  text-shadow: 0 1px 4px rgba(0,0,0,0.95);
  pointer-events: none;
}
/* Hover glow on server cards that have a banner */
:has(> .dl-server-banner) {
  transition: transform 0.2s, box-shadow 0.2s;
}
:has(> .dl-server-banner):hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 0 22px rgba(188,110,60,0.18);
}
:has(> .dl-server-banner):hover > .dl-server-banner {
  border-color: rgba(188,110,60,0.55);
  transform: scale(1.015);
}

/* Extra: Pterodactyl sidebar header logo override */
.navbar-brand img, .main-header .logo img, [class*="logo"] img {
  filter: drop-shadow(0 0 6px rgba(188,110,60,0.4));
}

/* === Credit Watch Ad / Wait modal === */
.dl-modal-overlay {
  position: fixed; inset: 0; z-index: 100000;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(8px);
  display: none;
  align-items: center; justify-content: center;
}
.dl-modal-overlay.active { display: flex; }
.dl-modal {
  background: rgba(20,15,12,0.98);
  border: 1px solid rgba(188,110,60,0.3);
  border-radius: 16px;
  padding: 2rem; max-width: 480px; width: 90%;
  text-align: center; position: relative;
  box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 80px rgba(188,110,60,0.1);
}
.dl-modal h2 {
  font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 900;
  color: #ef4444; margin-bottom: 0.5rem; letter-spacing: 0.05em;
  text-transform: uppercase;
}
.dl-modal .dl-modal-sub {
  color: #888; font-size: 0.85rem; margin-bottom: 1.5rem;
}
.dl-modal .dl-credit-info {
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem;
}
.dl-modal .dl-credit-info .you-have {
  color: #ef4444; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em;
}
.dl-modal .dl-credit-info .credits-num {
  font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #ef4444;
}
.dl-modal .dl-credit-info .credits-need {
  color: #666; font-size: 0.8rem; margin-top: 0.2rem;
}
.dl-modal-actions { display: flex; flex-direction: column; gap: 0.6rem; }
.dl-modal-btn {
  padding: 0.8rem 1.2rem; border: none; border-radius: 10px;
  font-weight: 600; font-size: 0.9rem; cursor: pointer;
  transition: all 0.2s; font-family: 'Inter', sans-serif;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  text-decoration: none;
}
.dl-modal-btn-ad {
  background: linear-gradient(135deg, #bc6e3c, #e89060); color: #fff;
}
.dl-modal-btn-ad:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(188,110,60,0.4); }
.dl-modal-btn-wait {
  background: rgba(40,40,40,0.9); color: #aaa; border: 1px solid rgba(255,255,255,0.08);
}
.dl-modal-btn-wait:hover { background: rgba(60,60,60,0.9); color: #fff; }
.dl-modal-btn-close {
  background: transparent; color: #555; font-size: 0.8rem;
}
.dl-modal-btn-close:hover { color: #888; }
.dl-modal .dl-reset-info {
  margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06);
  color: #555; font-size: 0.75rem;
}
.dl-modal .dl-reset-info strong { color: #e89060; }

/* Ad player overlay */
.dl-ad-player {
  position: fixed; inset: 0; z-index: 100001;
  background: rgba(0,0,0,0.95);
  display: none; align-items: center; justify-content: center; flex-direction: column;
}
.dl-ad-player.active { display: flex; }
.dl-ad-player .dl-ad-frame {
  width: 90%; max-width: 640px; height: 360px;
  background: #111; border: 1px solid rgba(188,110,60,0.3);
  border-radius: 12px; overflow: hidden;
  display: flex; align-items: center; justify-content: center; flex-direction: column;
}
.dl-ad-player .dl-ad-title {
  color: #e89060; font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;
  font-family: 'Cinzel', serif;
}
.dl-ad-player .dl-ad-sponsor {
  color: #666; font-size: 0.8rem; margin-bottom: 1rem;
}
.dl-ad-player .dl-ad-link {
  display: inline-block; padding: 0.6rem 1.5rem;
  background: linear-gradient(135deg, #bc6e3c, #e89060); color: #fff;
  border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.85rem;
}
.dl-ad-player .dl-ad-timer {
  margin-top: 1rem; color: #aaa; font-size: 0.9rem; font-family: 'JetBrains Mono', monospace;
}
.dl-ad-player .dl-ad-timer .count { color: #e89060; font-weight: 700; font-size: 1.5rem; }
.dl-ad-player .dl-ad-progress {
  width: 90%; max-width: 640px; height: 4px; background: rgba(255,255,255,0.1);
  border-radius: 2px; margin-top: 0.5rem; overflow: hidden;
}
.dl-ad-player .dl-ad-progress-bar {
  height: 100%; background: linear-gradient(90deg, #bc6e3c, #e89060);
  width: 0%; transition: width 1s linear;
}
.dl-ad-player .dl-ad-reward {
  display: none; text-align: center;
}
.dl-ad-player .dl-ad-reward.active { display: block; }
.dl-ad-player .dl-ad-reward h3 {
  font-family: 'Cinzel', serif; font-size: 1.5rem; color: #22c55e; margin-bottom: 0.5rem;
}
.dl-ad-player .dl-ad-reward .reward-amount {
  font-family: 'JetBrains Mono', monospace; font-size: 3rem; font-weight: 700; color: #22c55e;
}
.dl-ad-player .dl-ad-reward .reward-msg {
  color: #aaa; font-size: 0.85rem; margin: 0.5rem 0 1.5rem;
}
</style>

<!-- BETA badge -->
<div class="dl-beta-badge">BETA</div>

<!-- Brand watermark -->
<div class="dl-brand">Death Legion</div>

<!-- Floating nav icons -->
<div class="dl-nav-icons">
  <img src="${NAV_LOGO_URL}" class="dl-nav-logo" alt="Death Legion" title="Death Legion Panel" />
  <a href="/" class="dl-nav-icon" title="Panel">
    <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
    <span class="tooltip">Panel</span>
  </a>
  <a href="/credits" class="dl-nav-icon" title="Credits">
    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93V18h-2v1.93C7.95 19.5 5.5 17.05 5.07 14H7v-2H5.07C5.5 8.95 7.95 6.5 11 6.07V8h2V6.07c3.05.43 5.5 2.88 5.93 5.93H17v2h1.93c-.43 3.05-2.88 5.5-5.93 5.93z"/></svg>
    <span class="tooltip">Credits</span>
  </a>
  <a href="/ai-assistant" class="dl-nav-icon" title="AI Assistant">
    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
    <span class="tooltip">AI Assistant</span>
  </a>
  <a href="/ai-agent" class="dl-nav-icon" title="AI Agent" style="border-color:rgba(239,68,68,0.2)">
    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm-2-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
    <span class="tooltip">Autonomous Agent</span>
  </a>
  <a href="/statistics" class="dl-nav-icon" title="Statistics">
    <svg viewBox="0 0 24 24"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
    <span class="tooltip">Statistics</span>
  </a>
  <a href="/status" class="dl-nav-icon" title="Status">
    <svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>
    <span class="tooltip">System Status</span>
  </a>
  <div class="dl-credit-badge" id="dlCreditBadge">
    <span class="dot"></span>
    <span id="dlCreditCount">---</span> cr
  </div>
</div>

<!-- Credit depleted modal -->
<div class="dl-modal-overlay" id="dlCreditModal">
  <div class="dl-modal">
    <h2>Out of Credits</h2>
    <p class="dl-modal-sub">You need credits to start this server.</p>
    <div class="dl-credit-info">
      <div class="you-have">You have</div>
      <div class="credits-num" id="dlModalCredits">0</div>
      <div class="credits-need" id="dlModalNeeded">Need 5 credits to start</div>
    </div>
    <div class="dl-modal-actions">
      <button class="dl-modal-btn dl-modal-btn-ad" onclick="dlWatchAd()">
        ▶ Watch Ad — Earn 50 Credits
      </button>
      <button class="dl-modal-btn dl-modal-btn-wait" id="dlWaitBtn" onclick="dlShowWaitInfo()">
        Wait Until Tomorrow
      </button>
      <button class="dl-modal-btn dl-modal-btn-close" onclick="dlCloseModal()">
        Cancel
      </button>
    </div>
    <div class="dl-reset-info" id="dlResetInfo">
      Credits reset at <strong id="dlResetAt">midnight UTC</strong> (in <strong id="dlResetIn">--</strong>)
    </div>
  </div>
</div>

<!-- Ad player overlay -->
<div class="dl-ad-player" id="dlAdPlayer">
  <div class="dl-ad-frame" id="dlAdFrame">
    <div class="dl-ad-title" id="dlAdTitle">Advertisement</div>
    <div class="dl-ad-sponsor" id="dlAdSponsor">Sponsored content</div>
    <a class="dl-ad-link" id="dlAdLink" href="#" target="_blank" rel="noopener">Learn More</a>
    <div class="dl-ad-timer">Ad ends in <span class="count" id="dlAdCountdown">15</span>s</div>
  </div>
  <div class="dl-ad-progress">
    <div class="dl-ad-progress-bar" id="dlAdProgressBar"></div>
  </div>
  <div class="dl-ad-reward" id="dlAdReward">
    <h3>Reward Earned!</h3>
    <div class="reward-amount">+50</div>
    <div class="reward-msg" id="dlAdRewardMsg">Credits added to your account</div>
    <button class="dl-modal-btn dl-modal-btn-ad" onclick="dlCloseAdPlayer()">Continue</button>
  </div>
</div>

<script id="__LEGION_INJECT__">
(function() {
  // Inject Legion Auth button on login page
  function injectLegionAuth() {
    if (document.querySelector('.dl-legion-auth-btn')) return;
    var loginForm = document.querySelector('form');
    if (!loginForm) return;
    var hasPassword = loginForm.querySelector('input[type="password"]');
    if (!hasPassword) return;
    var divider = document.createElement('div');
    divider.className = 'dl-legion-divider';
    divider.innerHTML = '<span>OR</span>';
    loginForm.parentNode.insertBefore(divider, loginForm.nextSibling);
    var btn = document.createElement('a');
    btn.className = 'dl-legion-auth-btn';
    btn.href = '/legion-auth';
    btn.innerHTML = 'Connect with Death Legion';
    loginForm.parentNode.insertBefore(btn, divider.nextSibling);
  }

  // Load credit balance
  function loadCredits() {
    fetch('/api/client/account', { credentials:'include', headers:{'Accept':'application/json'} })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.attributes) {
          var username = data.attributes.username;
          fetch('/api/credits?action=balance&user=' + username)
            .then(function(r) { return r.json(); })
            .then(function(c) {
              var el = document.getElementById('dlCreditCount');
              if (el) el.textContent = c.credits === 'Unlimited' ? '\\u221e' : c.credits;
            })
            .catch(function() {});
        }
      })
      .catch(function() {});
  }

  // Run injections
  injectLegionAuth();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLegionAuth);
  }
  var observer = new MutationObserver(function() { injectLegionAuth(); });
  observer.observe(document.body, { childList: true, subtree: true });
  // === Login page detection (special bg) ===
  function detectLoginPage() {
    var path = window.location.pathname.toLowerCase();
    var isLogin = path.indexOf('/auth/login') !== -1
               || path === '/login'
               || (path.indexOf('/login') !== -1 && path.indexOf('/admin') === -1 && path.indexOf('/dashboard') === -1);
    if (isLogin) {
      document.body.classList.add('dl-login-page');
    } else {
      document.body.classList.remove('dl-login-page');
    }
  }

  // === Randomized server banner images (one per server, deterministic by name) ===
  // Pterodactyl dashboard renders each server as <a href="/server/{id}" class="group relative block ...">
  // We apply the banner as a background-image directly on the <a> itself, with a dark overlay.
  var SERVER_BANNERS = ${JSON.stringify(SERVER_BANNER_IMAGES)};
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
  function isServerHomeLink(href) {
    if (!href || href.indexOf('/server/') !== 0) return false;
    var rest = href.substring(8);
    if (rest.length === 0) return false;
    if (rest.indexOf('/') !== -1) return false;
    return true;
  }
  function extractServerName(card) {
    var h2 = card.querySelector('h2');
    if (h2 && h2.textContent) return h2.textContent.trim();
    var p = card.querySelector('p, .name, [class*="name"]');
    if (p && p.textContent) return p.textContent.trim();
    return '';
  }
  function injectServerBanners() {
    var links = document.querySelectorAll('a[href^="/server/"]');
    links.forEach(function(link) {
      var href = link.getAttribute('href') || '';
      if (!isServerHomeLink(href)) return;
      if (link.dataset.dlBanner === '1') return;
      // Skip tiny links (sidebar, breadcrumb, etc.) — real cards are >250px wide
      var rect = link.getBoundingClientRect();
      if (rect.width < 250) return;
      // Skip links that don't look like cards (no children, or only text content)
      if (link.children.length < 2) return;
      link.dataset.dlBanner = '1';
      var name = extractServerName(link) || href;
      var seed = hashStr(name + '|' + href);
      var img = SERVER_BANNERS[seed % SERVER_BANNERS.length];
      // Apply as background image with dark gradient overlay so text stays readable
      link.style.backgroundImage =
        'linear-gradient(135deg, rgba(15,12,10,0.86) 0%, rgba(20,12,8,0.94) 100%), url("' + img + '")';
      link.style.backgroundSize = 'cover';
      link.style.backgroundPosition = 'center';
      link.style.backgroundRepeat = 'no-repeat';
      // Ensure relative positioning for overlay layering
      if (!link.style.position || link.style.position === 'static') {
        link.style.position = 'relative';
      }
      // Add a small DL badge in the top-left corner if not already present
      if (!link.querySelector('.dl-card-badge')) {
        var badge = document.createElement('div');
        badge.className = 'dl-card-badge';
        badge.textContent = 'DL';
        link.insertBefore(badge, link.firstChild);
      }
    });
  }

  // === Run all dynamic injections ===
  detectLoginPage();
  injectServerBanners();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      detectLoginPage();
      injectServerBanners();
    });
  }
  var dlObserver = new MutationObserver(function() {
    detectLoginPage();
    injectServerBanners();
  });
  if (document.body) {
    dlObserver.observe(document.body, { childList: true, subtree: true });
  }
  setInterval(function() {
    detectLoginPage();
    injectServerBanners();
  }, 1500);

  setInterval(injectLegionAuth, 1000);
  setInterval(loadCredits, 5000);
  setTimeout(loadCredits, 2000);

  // === Credit system: intercept power-on API errors and show Watch Ad modal ===
  var dlOriginalFetch = window.fetch;
  window.fetch = function(url, options) {
    return dlOriginalFetch.apply(this, arguments).then(function(resp) {
      // Only intercept power-on requests
      var urlStr = String(url);
      if (urlStr.indexOf('/power') === -1) return resp;
      if (resp.status !== 403) return resp;
      // Clone the response so we can read the body
      var clone = resp.clone();
      clone.json().then(function(data) {
        var err = data.errors && data.errors[0];
        if (err && err.code === 'InsufficientCredits') {
          var meta = err.meta || {};
          dlShowCreditModal(meta.credits || 0, meta.needed || 5, meta.resetAt, meta.resetIn);
        }
      }).catch(function() {});
      return resp;
    });
  };

  // Also intercept XMLHttpRequest (Pterodactyl React SPA uses axios)
  var dlOriginalXHROpen = XMLHttpRequest.prototype.open;
  var dlOriginalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._dlUrl = url;
    this._dlMethod = method;
    return dlOriginalXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    var self = this;
    this.addEventListener('load', function() {
      if (self._dlUrl && self._dlUrl.indexOf('/power') !== -1 && self.status === 403) {
        try {
          var data = JSON.parse(self.responseText);
          var err = data.errors && data.errors[0];
          if (err && err.code === 'InsufficientCredits') {
            var meta = err.meta || {};
            dlShowCreditModal(meta.credits || 0, meta.needed || 5, meta.resetAt, meta.resetIn);
          }
        } catch(e) {}
      }
    });
    return dlOriginalXHRSend.apply(this, arguments);
  };

  // === Credit modal functions ===
  window.dlShowCreditModal = function(credits, needed, resetAt, resetIn) {
    var modal = document.getElementById('dlCreditModal');
    if (!modal) return;
    var cEl = document.getElementById('dlModalCredits');
    var nEl = document.getElementById('dlModalNeeded');
    var rAtEl = document.getElementById('dlResetAt');
    var rInEl = document.getElementById('dlResetIn');
    if (cEl) cEl.textContent = credits;
    if (nEl) nEl.textContent = 'Need ' + needed + ' credits to start';
    if (rAtEl && resetAt) rAtEl.textContent = new Date(resetAt).toLocaleTimeString();
    if (rInEl && resetIn) rInEl.textContent = resetIn;
    modal.classList.add('active');
  };
  window.dlCloseModal = function() {
    var modal = document.getElementById('dlCreditModal');
    if (modal) modal.classList.remove('active');
  };
  window.dlShowWaitInfo = function() {
    var btn = document.getElementById('dlWaitBtn');
    if (btn) {
      btn.innerHTML = '⏳ Credits reset at midnight UTC. Come back tomorrow!';
      btn.disabled = true;
    }
  };

  // === Ad player ===
  window.dlWatchAd = function() {
    dlCloseModal();
    // Get a random ad
    dlOriginalFetch('/api/ads?action=random', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({user: window._dlUsername || 'guest'}) })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success) {
          alert('No more ads available today. Please wait until tomorrow for credits to reset.');
          return;
        }
        dlPlayAd(data.ad);
      })
      .catch(function(e) { alert('Failed to load ad: ' + e.message); });
  };

  window.dlPlayAd = function(ad) {
    var player = document.getElementById('dlAdPlayer');
    var frame = document.getElementById('dlAdFrame');
    var titleEl = document.getElementById('dlAdTitle');
    var sponsorEl = document.getElementById('dlAdSponsor');
    var linkEl = document.getElementById('dlAdLink');
    var countdownEl = document.getElementById('dlAdCountdown');
    var progressEl = document.getElementById('dlAdProgressBar');
    var rewardEl = document.getElementById('dlAdReward');

    if (!player) return;
    // Reset UI
    if (frame) frame.style.display = 'flex';
    if (rewardEl) rewardEl.classList.remove('active');
    if (titleEl) titleEl.textContent = ad.title;
    if (sponsorEl) sponsorEl.textContent = 'Sponsored by ' + ad.title;
    if (linkEl) linkEl.href = ad.url;
    var duration = ad.duration || 15;
    var remaining = duration;
    if (countdownEl) countdownEl.textContent = remaining;
    if (progressEl) progressEl.style.width = '0%';

    player.classList.add('active');

    var interval = setInterval(function() {
      remaining--;
      if (countdownEl) countdownEl.textContent = remaining;
      if (progressEl) progressEl.style.width = ((duration - remaining) / duration * 100) + '%';
      if (remaining <= 0) {
        clearInterval(interval);
        dlClaimAdReward(ad);
      }
    }, 1000);
  };

  window.dlClaimAdReward = function(ad) {
    var username = window._dlUsername || 'guest';
    dlOriginalFetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: username, action: 'watch', adId: ad.id })
    })
      .then(function(r) { return r.json(); })
      .catch(function() { return null; })
      .then(function(data) {
        var frame = document.getElementById('dlAdFrame');
        var rewardEl = document.getElementById('dlAdReward');
        var msgEl = document.getElementById('dlAdRewardMsg');
        if (frame) frame.style.display = 'none';
        if (rewardEl) rewardEl.classList.add('active');
        if (msgEl && data) {
          msgEl.textContent = data.message || ('+50 credits added. New balance: ' + (data.newBalance || 'N/A'));
        }
        // Refresh credit badge
        setTimeout(loadCredits, 500);
      });
  };

  window.dlCloseAdPlayer = function() {
    var player = document.getElementById('dlAdPlayer');
    if (player) player.classList.remove('active');
  };

  // Get username for ad rewards
  dlOriginalFetch('/api/client/account', { credentials: 'include', headers: { 'Accept': 'application/json' } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data && data.attributes) {
        window._dlUsername = data.attributes.username;
      }
    })
    .catch(function() {});
})();
</script>`;
          if (bodyStr.includes('</body>')) {
            bodyStr = bodyStr.replace('</body>', legionInjection + '\n</body>');
          } else {
            bodyStr += legionInjection;
          }
        }
      }

      const rewritten = Buffer.from(bodyStr, 'utf8');
      res.setHeader('Content-Length', rewritten.length.toString());
      return res.send(rewritten);
    } else {
      res.setHeader('Content-Length', buffer.length.toString());
      return res.send(buffer);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('Proxy error:', error, 'target:', targetUrl);
    return res.status(502).json({
      errors: [{
        code: 'ProxyError',
        status: '502',
        detail: `Backend unreachable: ${error}`,
      }],
    });
  }
}

export const config = {
  api: { bodyParser: false, sizeLimit: '50mb' },
  maxDuration: 300,
};
