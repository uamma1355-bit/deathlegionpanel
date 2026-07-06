import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errors: [{ code: 'MethodNotAllowed', status: '405' }] });
  }

  const { user, password } = req.body as { user?: string; password?: string };
  if (!user || !password) {
    return res.status(400).json({ errors: [{ code: 'ValidationError', detail: 'user and password required' }] });
  }

  // Use a Python script for proper string handling — bash quoting with JSON is fragile
  const pyScript = `import json, subprocess, tempfile, os

user_val = ${JSON.stringify(user)}
pass_val = ${JSON.stringify(password)}

cookie_file = tempfile.mktemp()

# Step 1: Login
login_result = subprocess.run([
    'curl', '-s', '-c', cookie_file,
    '-H', 'Accept: application/json',
    '-H', 'Content-Type: application/json',
    '-X', 'POST',
    '-d', json.dumps({"user": user_val, "password": pass_val}),
    'http://127.0.0.1:8000/api/client/auth/login'
], capture_output=True, text=True)

try:
    login_data = json.loads(login_result.stdout)
except:
    print(json.dumps({"errors": [{"code": "LoginError", "detail": "Failed to parse login response"}]}))
    os.unlink(cookie_file)
    exit(0)

# Check for 2FA
if login_data.get('data', {}).get('complete') is False:
    token = login_data.get('data', {}).get('confirmation_token', '')
    print(json.dumps({"complete": False, "confirmation_token": token}))
    os.unlink(cookie_file)
    exit(0)

# Check login success
if not login_data.get('data', {}).get('complete'):
    print(json.dumps({"errors": [{"code": "LoginFailed", "detail": "Invalid credentials"}]}))
    os.unlink(cookie_file)
    exit(0)

user_info = login_data.get('data', {}).get('user', {})

# Step 2: Create API key
key_result = subprocess.run([
    'curl', '-s', '-b', cookie_file,
    '-H', 'Accept: application/json',
    '-H', 'Content-Type: application/json',
    '-X', 'POST',
    '-d', json.dumps({"description": "browser-session", "allowed_ips": []}),
    'http://127.0.0.1:8000/api/client/account/api-keys'
], capture_output=True, text=True)

try:
    key_data = json.loads(key_result.stdout)
except:
    key_data = {}

identifier = key_data.get('attributes', {}).get('identifier', '')
secret = key_data.get('meta', {}).get('secret_token', '')
full_token = identifier + secret if identifier and secret else ''

os.unlink(cookie_file)

# Step 3: Return combined response
print(json.dumps({
    "token": full_token,
    "user": user_info,
    "complete": True
}))
`;

  const executeUrl = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;

  try {
    const response = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAYTONA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: `python3 -c '${pyScript.replace(/'/g, "'\\''")}'`,
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
