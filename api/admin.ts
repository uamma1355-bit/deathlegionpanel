import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

/**
 * Proxy for the admin Blade area.
 * Fetches HTML from the backend's /admin/* path via the Daytona execute API.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.replace('/admin', '') || '/';
  const backendPath = `/admin${path === '/' ? '' : path}`;
  
  // Build curl command
  let curlCmd = `curl -s -w '\\n__HTTP_STATUS__:%{http_code}'`;
  
  // Forward cookies for session auth
  const cookieHeader = req.headers['cookie'] as string;
  if (cookieHeader) {
    curlCmd += ` -H 'Cookie: ${cookieHeader.replace(/'/g, "'\\''")}'`;
  }
  
  // Forward method
  const method = req.method || 'GET';
  curlCmd += ` -X ${method}`;
  
  // Forward body for POST
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    curlCmd += ` -d '${bodyStr.replace(/'/g, "'\\''")}'`;
  }
  
  curlCmd += ` 'http://127.0.0.1:8000${backendPath.replace(/'/g, "'\\''")}'`;
  
  const executeUrl = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;
  
  try {
    const response = await fetch(executeUrl, {
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
    const result: string = data.result || '';
    
    // Extract HTTP status
    const statusMatch = result.match(/__HTTP_STATUS__:(\d+)$/);
    const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : 200;
    const body = statusMatch 
      ? result.slice(0, result.length - statusMatch[0].length).replace(/\n$/, '')
      : result;
    
    // Set content type based on response
    if (body.includes('<!DOCTYPE html>') || body.includes('<html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (body.startsWith('{') || body.startsWith('[')) {
      res.setHeader('Content-Type', 'application/json');
    }
    
    return res.status(httpStatus).send(body);
  } catch (err) {
    return res.status(500).send(`Admin proxy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
