import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_PANEL_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu';
const DAYTONA_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu';

// Healing page HTML — shown when backend is unreachable
function healingPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DeathLegion Panel — Healing</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'IBM Plex Sans', -apple-system, sans-serif; background: #0f0f0f; color: #e5e5e5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 640px; width: 90%; text-align: center; padding: 2rem; }
    .logo { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem; background: linear-gradient(135deg, #bc6e3c 0%, #e89060 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .subtitle { color: #888; margin-bottom: 2.5rem; font-size: 0.95rem; }
    .spinner { width: 60px; height: 60px; border: 4px solid #3a2a0e; border-top-color: #f59e0b; border-right-color: #f59e0b; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
    .pulse { animation: pulse 2s ease-in-out infinite; }
    .status-text { color: #f59e0b; font-size: 1.3rem; font-weight: 600; margin-bottom: 0.5rem; }
    .msg { color: #ccc; margin-bottom: 1.5rem; line-height: 1.6; }
    .countdown { color: #888; font-size: 0.9rem; margin: 1rem 0; }
    .countdown strong { color: #f59e0b; }
    .steps { display: flex; flex-direction: column; gap: 0.5rem; margin: 1.5rem 0; text-align: left; }
    .step { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 0.9rem; color: #aaa; }
    .step .dot { width: 8px; height: 8px; border-radius: 50%; background: #444; flex-shrink: 0; }
    .step.active .dot { background: #f59e0b; animation: blink 1s ease-in-out infinite; }
    .step.done .dot { background: #22c55e; }
    .step.done { color: #666; }
    .manual-link { display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #bc6e3c; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; }
    .manual-link:hover { background: #d97f4a; }
    .meta { margin-top: 2rem; font-size: 0.75rem; color: #555; font-family: monospace; line-height: 1.6; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">DeathLegion Panel</div>
    <div class="subtitle">Self-healing system is restoring the panel</div>
    <div class="pulse">
      <div class="spinner"></div>
      <div class="status-text">Healing in Progress</div>
      <div class="msg">The Pterodactyl panel is temporarily unavailable.<br>GitHub Actions self-healing is bringing it back online.<br>This usually takes 1-3 minutes.</div>
      <div class="countdown">Next check in <strong id="cd">10s</strong></div>
    </div>
    <div class="steps" id="steps"></div>
    <a href="/" class="manual-link">Retry now</a>
    <div class="meta" id="meta">Last check: loading...</div>
  </div>
  <script>
    var countdown = 10;
    var healStep = 0;
    var healSteps = ['Detecting panel failure','Starting MySQL database','Starting Redis cache','Starting PHP application server','Starting nginx reverse proxy','Starting Wings daemon','Verifying panel health','Panel restored — redirecting'];
    function renderSteps() {
      var html = '';
      for (var i = 0; i < healSteps.length; i++) {
        var cls = '';
        if (i < healStep) cls = 'done';
        else if (i === healStep) cls = 'active';
        html += '<div class="step ' + cls + '"><span class="dot"></span><span>' + healSteps[i] + '</span></div>';
      }
      document.getElementById('steps').innerHTML = html;
    }
    async function check() {
      try {
        var r = await fetch('/api/health', { cache: 'no-store' });
        var d = await r.json();
        document.getElementById('meta').innerHTML = 'Last check: ' + new Date().toISOString() + '<br>Backend: ' + d.panel.status + ' (' + d.panel.http_code + ')<br>Self-heal: ' + d.self_heal.status + ' (' + d.self_heal.last_run_conclusion + ')';
        if (d.status === 'healthy') {
          // Backend is back — redirect to panel
          window.location.href = '/';
          return;
        }
      } catch (e) {
        document.getElementById('meta').innerHTML = 'Last check: ' + new Date().toISOString() + '<br>Error: ' + e.message;
      }
      countdown = 10;
      renderSteps();
      tick();
    }
    function tick() {
      countdown--;
      if (countdown <= 0) {
        if (healStep < healSteps.length - 1) healStep++;
        check();
      } else {
        document.getElementById('cd').textContent = countdown + 's';
        setTimeout(tick, 1000);
      }
    }
    renderSteps();
    check();
  </script>
</body>
</html>`;
}

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
    .replace(new RegExp('https?://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15\\.daytonaproxy01\\.eu(?::443|:8000)?', 'g'), `https://${vercelHost}`)
    .replace(new RegExp('8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15\\.daytonaproxy01\\.eu', 'g'), vercelHost)
    .replace(new RegExp('wss?://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15\\.daytonaproxy01\\.eu(?::443)?', 'g'), (match) => {
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

  // Forward headers to backend
  const forwardHeaders: Record<string, string> = {
    'Accept': req.headers['accept'] || '*/*',
    'Accept-Encoding': 'identity',
    'Accept-Language': req.headers['accept-language'] || '',
    // Non-browser User-Agent bypasses Daytona's "Preview URL Warning" interstitial
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

  // Build request body — bodyParser is disabled, so read raw stream for all body methods
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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

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
          new RegExp('https?://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15\\.daytonaproxy01\\.eu(?::443|:8000)?', 'g'),
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
      bodyStr = rewriteBody(bodyStr, vercelHost);

      // Inject WebSocket interceptor into HTML
      if (contentType.includes('text/html') && !bodyStr.includes('__WS_INTERCEPTOR_INJECTED__')) {
        const wingsHostB64 = Buffer.from(DAYTONA_HOST).toString('base64');
        const interceptor = `
<script id="__WS_INTERCEPTOR_INJECTED__">
(function() {
  var WINGS_HOST = atob('${wingsHostB64}');
  var OrigWebSocket = window.WebSocket;
  function PatchedWebSocket(url, protocols) {
    if (url && url.charAt(0) === '/') {
      url = 'wss://' + WINGS_HOST + url;
    }
    return protocols ? new OrigWebSocket(url, protocols) : new OrigWebSocket(url);
  }
  PatchedWebSocket.prototype = OrigWebSocket.prototype;
  PatchedWebSocket.CONNECTING = OrigWebSocket.CONNECTING;
  PatchedWebSocket.OPEN = OrigWebSocket.OPEN;
  PatchedWebSocket.CLOSING = OrigWebSocket.CLOSING;
  PatchedWebSocket.CLOSED = OrigWebSocket.CLOSED;
  window.WebSocket = PatchedWebSocket;
})();
</script>`;
        if (bodyStr.includes('</head>')) {
          bodyStr = bodyStr.replace('</head>', interceptor + '</head>');
        } else if (bodyStr.includes('<body')) {
          bodyStr = bodyStr.replace('<body', interceptor + '<body');
        } else {
          bodyStr = interceptor + bodyStr;
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
    // Backend unreachable — show healing page instead of error
    const error = err instanceof Error ? err.message : String(err);
    console.error('Proxy error:', error, 'target:', targetUrl);

    // Only show healing page for HTML requests (browser navigation)
    const accept = req.headers['accept'] || '';
    if (accept.includes('text/html')) {
      res.status(200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(healingPageHtml());
    }

    // For API requests, return JSON error
    return res.status(502).json({
      errors: [{
        code: 'ProxyError',
        status: '502',
        detail: `Backend unreachable: ${error}`,
      }],
    });
  }
}

// Disable Vercel body parsing so multipart file uploads work
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '50mb',
  },
  maxDuration: 300,
};
