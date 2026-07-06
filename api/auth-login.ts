import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

/**
 * Combined login + API key creation endpoint.
 * Runs a shell script inside the sandbox that:
 *   1. Logs in (saves session cookie to a file)
 *   2. Creates an API key (using that cookie)
 *   3. Returns the token + user info
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errors: [{ code: 'MethodNotAllowed', status: '405' }] });
  }

  const { user, password } = req.body as { user?: string; password?: string };
  if (!user || !password) {
    return res.status(400).json({ errors: [{ code: 'ValidationError', detail: 'user and password required' }] });
  }

  // Write the login+key script to a temp file, then execute it
  // This avoids shell quoting issues with the JSON body
  const script = `cat > /tmp/login_script.sh << 'ENDSCRIPT'
#!/bin/bash
set -e
COOKIE_FILE=$(mktemp)

# Step 1: Login
LOGIN_RESP=$(curl -s -c "$COOKIE_FILE" -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -X POST -d '{"user":"'${USER_VAL}'","password":"'${PASS_VAL}'"}' \
  http://127.0.0.1:8000/api/client/auth/login)

# Check if login succeeded
COMPLETE=$(echo "$LOGIN_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('complete',False))" 2>/dev/null || echo "False")
if [ "$COMPLETE" != "True" ]; then
  echo "$LOGIN_RESP"
  rm -f "$COOKIE_FILE"
  exit 0
fi

# Extract user info
USER_INFO=$(echo "$LOGIN_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('data',{}).get('user',{})))" 2>/dev/null)

# Step 2: Create API key using the session cookie
KEY_RESP=$(curl -s -b "$COOKIE_FILE" -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -X POST -d '{"description":"browser-session","allowed_ips":[]}' \
  http://127.0.0.1:8000/api/client/account/api-keys)

# Extract identifier + secret_token
IDENTIFIER=$(echo "$KEY_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('attributes',{}).get('identifier',''))" 2>/dev/null)
SECRET=$(echo "$KEY_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('meta',{}).get('secret_token',''))" 2>/dev/null)

FULL_TOKEN="${IDENTIFIER}${SECRET}"

# Step 3: Return combined response
python3 -c "
import json
user = json.loads('''${USER_INFO}''')
result = {
    'token': '${FULL_TOKEN}',
    'user': user,
    'complete': True,
}
print(json.dumps(result))
"

rm -f "$COOKIE_FILE"
ENDSCRIPT
chmod +x /tmp/login_script.sh
USER_VAL='${user.replace(/'/g, "'\\''")}' PASS_VAL='${password.replace(/'/g, "'\\''")}' bash /tmp/login_script.sh
rm -f /tmp/login_script.sh`;

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
      return res.status(502).json({
        errors: [{ code: 'ProxyError', status: '502', detail: `Daytona API error: ${response.status}` }],
      });
    }

    const data = await response.json();
    const result: string = (data.result || '').trim();

    try {
      const parsed = JSON.parse(result);
      if (parsed.errors) {
        return res.status(400).json(parsed);
      }
      if (parsed.data && parsed.data.complete === false && parsed.data.confirmation_token) {
        return res.status(200).json({
          complete: false,
          confirmation_token: parsed.data.confirmation_token,
        });
      }
      return res.status(200).json(parsed);
    } catch {
      return res.status(500).json({
        errors: [{ code: 'ParseError', detail: `Failed to parse: ${result.slice(0, 300)}` }],
      });
    }
  } catch (err) {
    return res.status(500).json({
      errors: [{ code: 'ProxyError', detail: `Login failed: ${err instanceof Error ? err.message : String(err)}` }],
    });
  }
}
