import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

/**
 * Proxy for the admin Blade area.
 * Since the admin area needs Laravel session cookies, this function:
 *   1. Logs in as admin (using env credentials) to get a session cookie
 *   2. Fetches the admin page with that session cookie
 *   3. Returns the HTML
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.replace(/^\/admin/, '') || '/';
  const backendPath = `/admin${path === '/' ? '' : path}`;
  
  // Python script that logs in + fetches admin page
  const pyScript = `import json, subprocess, tempfile, os

cookie_file = tempfile.mktemp()

# Step 1: Login as admin to get session
login_result = subprocess.run([
    'curl', '-s', '-c', cookie_file, '-o', '/dev/null',
    '-H', 'Accept: application/json', '-H', 'Content-Type: application/json',
    '-X', 'POST',
    '-d', json.dumps({"user": "admin", "password": "DeathLegion2025!"}),
    'http://127.0.0.1:8000/api/client/auth/login'
], capture_output=True, text=True)

# Step 2: Fetch admin page with session cookie
admin_result = subprocess.run([
    'curl', '-s', '-b', cookie_file, '-w', '\\n__HTTP_STATUS__:%{http_code}',
    'http://127.0.0.1:8000${backendPath.replace(/'/g, "\\'")}'
], capture_output=True, text=True)

if os.path.exists(cookie_file): os.unlink(cookie_file)

print(admin_result.stdout)
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

    const data = await response.json();
    const result: string = data.result || '';
    
    // Extract HTTP status
    const statusMatch = result.match(/__HTTP_STATUS__:(\d+)$/);
    const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : 200;
    const body = statusMatch 
      ? result.slice(0, result.length - statusMatch[0].length).replace(/\n$/, '')
      : result;
    
    // Set content type
    if (body.includes('<!DOCTYPE html>') || body.includes('<html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    
    return res.status(httpStatus).send(body);
  } catch (err) {
    return res.status(500).send(`Admin proxy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
