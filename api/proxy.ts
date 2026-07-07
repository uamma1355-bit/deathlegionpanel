import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_PANEL_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu';
const DAYTONA_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu';

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

  // === SPECIAL HANDLING: WebSocket token endpoint returns a direct Wings URL ===
  // The Panel returns: { socket: "wss://daytona-host/api/servers/{uuid}/ws", token: "..." }
  // We rewrite this to: { socket: "wss://vercel-host/api/servers/{uuid}/ws", token: "..." }
  // Then the browser connects to wss://vercel-host/api/servers/{uuid}/ws
  // Vercel serverless can't proxy WebSocket, so we return the real Wings URL
  // as a custom header that the client-side script uses to reconnect.
  //
  // Actually, the Panel already returns the Wings URL — we just rewrite it to
  // point to the Vercel host. Then we inject a script that intercepts
  // WebSocket connections and redirects them to the real Wings URL.

  // Forward headers to backend
  const forwardHeaders: Record<string, string> = {
    'Accept': req.headers['accept'] || '*/*',
    'Accept-Encoding': 'identity',
    'Accept-Language': req.headers['accept-language'] || '',
    'User-Agent': req.headers['user-agent'] || 'VercelProxy/1.0',
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

  // Build request body
  let body: Buffer | undefined;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && req.body) {
    body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
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

      // For HTML responses, inject a small script that intercepts WebSocket
      // connections and rewrites them to point directly to Wings (since Vercel
      // serverless functions can't proxy WebSocket upgrades).
      if (contentType.includes('text/html') && !bodyStr.includes('__WS_INTERCEPTOR_INJECTED__')) {
        // Base64-encode the Wings host so it's not visible in plain source
        const wingsHostB64 = Buffer.from(DAYTONA_HOST).toString('base64');
        const interceptor = `
<script id="__WS_INTERCEPTOR_INJECTED__">
(function() {
  var WINGS_HOST = atob('${wingsHostB64}');
  var OrigWebSocket = window.WebSocket;
  function PatchedWebSocket(url, protocols) {
    if (url && url.charAt(0) === '/') {
      // Relative URL → resolve to Wings host
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
        // Inject before </head> or at the start of <body>
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
