import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
  const backendPath = `/api/${path}`;
  
  // Build the target URL — use the Daytona toolbox execute API to run a curl command
  // that hits the local backend. This bypasses the preview URL auth wall.
  const targetUrl = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;
  
  // Build the curl command to run inside the sandbox
  const method = req.method || 'GET';
  const headers = JSON.stringify(req.headers);
  const body = req.body ? JSON.stringify(req.body) : '';
  
  // For GET requests, just forward the URL
  // For POST/PUT/DELETE, forward the body
  let curlCmd: string;
  if (method === 'GET' || method === 'HEAD') {
    curlCmd = `curl -s -X ${method} -H 'Accept: application/json' -H 'Content-Type: application/json' http://127.0.0.1:8000${backendPath}`;
  } else {
    const escapedBody = body.replace(/'/g, "'\\''");
    curlCmd = `curl -s -X ${method} -H 'Accept: application/json' -H 'Content-Type: application/json' -d '${escapedBody}' http://127.0.0.1:8000${backendPath}`;
  }
  
  // Forward auth header if present
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    curlCmd += ` -H 'Authorization: ${authHeader}'`;
  }
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAYTONA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: curlCmd,
        cwd: '/home/daytona',
        timeout: 30,
      }),
    });
    
    const data = await response.json();
    const result = data.result || '';
    const exitCode = data.exitCode || 0;
    
    // Try to parse the result as JSON
    try {
      const parsed = JSON.parse(result);
      res.status(200).json(parsed);
    } catch {
      // If not JSON, return as text
      res.status(500).json({ error: 'Backend returned non-JSON', result, exitCode });
    }
  } catch (err) {
    res.status(500).json({ error: 'Proxy failed', detail: String(err) });
  }
}
