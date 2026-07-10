import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errors: [{ code: 'MethodNotAllowed', status: '405' }] });
  }

  const { user, password } = req.body as { user?: string; password?: string };
  if (!user || !password) {
    return res.status(400).json({ errors: [{ code: 'ValidationError', detail: 'user and password required' }] });
  }

  const userJson = JSON.stringify(user);
  const passJson = JSON.stringify(password);

  // Use Python's requests-like approach with proper cookie handling
  const pyScript = `import json, subprocess, tempfile, os
from http.cookiejar import MozillaCookieJar
from urllib.parse import unquote

user_val = ${userJson}
pass_val = ${passJson}
cookie_file = tempfile.mktemp(suffix='.txt')

# Step 1: Get CSRF cookie
subprocess.run([
    'curl', '-s', '-c', cookie_file, '-o', '/dev/null',
    'http://127.0.0.1:8000/sanctum/csrf-cookie'
], capture_output=True, text=True)

# Parse cookie jar to get XSRF token
xsrf_token = ''
try:
    jar = MozillaCookieJar(cookie_file)
    jar.load(ignore_discard=True, ignore_expires=True)
    for cookie in jar:
        if cookie.name == 'XSRF-TOKEN':
            xsrf_token = unquote(cookie.value)
            break
except Exception as e:
    pass

# Step 2: Login
login_result = subprocess.run([
    'curl', '-s', '-c', cookie_file, '-b', cookie_file,
    '-H', 'Accept: application/json',
    '-H', 'Content-Type: application/json',
    '-H', f'X-XSRF-TOKEN: {xsrf_token}',
    '-H', 'X-Requested-With: XMLHttpRequest',
    '-X', 'POST',
    '-d', json.dumps({"user": user_val, "password": pass_val}),
    'http://127.0.0.1:8000/auth/login'
], capture_output=True, text=True)

try:
    login_data = json.loads(login_result.stdout)
except:
    print(json.dumps({"errors": [{"code": "LoginError", "detail": "Parse failed: " + login_result.stdout[:200]}]}))
    if os.path.exists(cookie_file): os.unlink(cookie_file)
    exit(0)

# 2FA check
if login_data.get('data', {}).get('complete') is False:
    token = login_data.get('data', {}).get('confirmation_token', '')
    print(json.dumps({"complete": False, "confirmation_token": token}))
    if os.path.exists(cookie_file): os.unlink(cookie_file)
    exit(0)

# Login failed
if not login_data.get('data', {}).get('complete'):
    detail = 'Invalid credentials'
    if login_data.get('errors'):
        detail = login_data['errors'][0].get('detail', detail)
    print(json.dumps({"errors": [{"code": "LoginFailed", "detail": detail}]}))
    if os.path.exists(cookie_file): os.unlink(cookie_file)
    exit(0)

user_info = login_data.get('data', {}).get('user', {})

# Step 3: Create API key (need to re-read cookies after login since session changed)
key_result = subprocess.run([
    'curl', '-s', '-c', cookie_file, '-b', cookie_file,
    '-H', 'Accept: application/json', '-H', 'Content-Type: application/json',
    '-H', f'X-XSRF-TOKEN: {xsrf_token}',
    '-H', 'X-Requested-With: XMLHttpRequest',
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

if os.path.exists(cookie_file): os.unlink(cookie_file)

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
