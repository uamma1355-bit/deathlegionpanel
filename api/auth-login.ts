import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

/**
 * Combined login + API key creation endpoint.
 * 
 * The browser calls this with {user, password}. This function:
 *   1. Logs in via curl (gets session cookie)
 *   2. Creates an API key using the session cookie
 *   3. Returns {token, user} in one response
 * 
 * The browser then uses the token (Authorization: Bearer ptlc_...) for all
 * subsequent requests via /api/[...path].ts — no cookies needed.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errors: [{ code: 'MethodNotAllowed', status: '405' }] });
  }

  const { user, password } = req.body as { user: string; password: string };
  if (!user || !password) {
    return res.status(400).json({ errors: [{ code: 'ValidationError', detail: 'user and password required' }] });
  }

  const escapedUser = user.replace(/'/g, "'\\''");
  const escapedPass = password.replace(/'/g, "'\\''");

  // Combined script: login → extract session cookie → create API key → return token
  // All in one curl pipeline inside the sandbox
  const script = `COOKIE_FILE=$(mktemp) && \
curl -s -c "$COOKIE_FILE" -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -X POST -d '{"user":"${escapedUser}","password":"${escapedPass}"}' \
  http://127.0.0.1:8000/api/client/auth/login > /tmp/login_resp.json && \
LOGIN_COMPLETE=$(python3 -c "import json; d=json.load(open('/tmp/login_resp.json')); print(d.get('data',{}).get('complete', False))" 2>/dev/null) && \
if [ "$LOGIN_COMPLETE" != "True" ]; then \
  cat /tmp/login_resp.json; \
  rm -f "$COOKIE_FILE" /tmp/login_resp.json; \
  exit 0; \
fi && \
KEY_RESP=$(curl -s -b "$COOKIE_FILE" -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -X POST -d '{"description":"browser-session","allowed_ips":[]}' \
  http://127.0.0.1:8000/api/client/account/api-keys) && \
python3 -c "
import json
login = json.load(open('/tmp/login_resp.json'))
key = json.loads('''$KEY_RESP''')
identifier = key.get('attributes',{}).get('identifier','')
token = key.get('meta',{}).get('secret_token','')
full_token = identifier + token if identifier and token else ''
user_data = login.get('data',{}).get('user',{})
result = {
    'token': full_token,
    'user': user_data,
    'complete': True,
}
print(json.dumps(result))
" && \
rm -f "$COOKIE_FILE" /tmp/login_resp.json`;

  const executeUrl = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;

  try {
    const response = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAYTONA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: script,
        cwd: '/home/daytona',
        timeout: 30,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        errors: [{
          code: 'ProxyError',
          status: '502',
          detail: `Daytona API error: ${response.status}`,
        }],
      });
    }

    const data = await response.json();
    const result: string = data.result || '';

    // Try to parse the result as JSON
    try {
      const parsed = JSON.parse(result.trim());
      
      // Check if it's an error response from the backend
      if (parsed.errors) {
        return res.status(400).json(parsed);
      }
      
      // Check if it's a 2FA challenge
      if (parsed.data && parsed.data.complete === false && parsed.data.confirmation_token) {
        return res.status(200).json({
          complete: false,
          confirmation_token: parsed.data.confirmation_token,
        });
      }
      
      // Success — return token + user
      return res.status(200).json(parsed);
    } catch {
      // Not JSON — return as error
      return res.status(500).json({
        errors: [{
          code: 'ParseError',
          detail: `Failed to parse response: ${result.slice(0, 200)}`,
        }],
      });
    }
  } catch (err) {
    return res.status(500).json({
      errors: [{
        code: 'ProxyError',
        detail: `Login proxy failed: ${err instanceof Error ? err.message : String(err)}`,
      }],
    });
  }
}
