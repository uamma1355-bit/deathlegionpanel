import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.replace(/^\/admin/, '') || '/';
  const backendPath = `/admin${path === '/' ? '' : path}`;
  
  const escapedPath = backendPath.replace(/'/g, "\\'");
  
  const pyScript = `import json, subprocess, tempfile, os

cookie_file = tempfile.mktemp()

# Login as admin
subprocess.run([
    'curl', '-s', '-c', cookie_file, '-o', '/dev/null',
    '-H', 'Accept: application/json', '-H', 'Content-Type: application/json',
    '-X', 'POST',
    '-d', json.dumps({"user": "admin", "password": "DeathLegion2025!"}),
    'http://127.0.0.1:8000/api/client/auth/login'
], capture_output=True, text=True)

# Fetch admin page
result = subprocess.run([
    'curl', '-s', '-b', cookie_file,
    'http://127.0.0.1:8000${escapedPath}'
], capture_output=True, text=True)

if os.path.exists(cookie_file): os.unlink(cookie_file)

# Return ONLY the body (no status marker)
sys_out = result.stdout
print(sys_out)
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
    
    // The result from the execute API is JSON-encoded, so we need to handle it
    // The Python script prints the HTML, which becomes the "result" field
    let body = result;
    
    // Strip any trailing __HTTP_STATUS__ marker if present
    const statusMatch = body.match(/\n__HTTP_STATUS__:(\d+)$/);
    if (statusMatch) {
      body = body.slice(0, body.length - statusMatch[0].length);
    }
    
    // Set content type
    if (body.includes('<!DOCTYPE html>') || body.includes('<html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    
    return res.status(200).send(body);
  } catch (err) {
    return res.status(500).send(`Admin proxy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
