import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Build the backend path from the Vercel route params
  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const path = pathParts.filter(Boolean).join('/');
  const backendPath = `/api/${path}`;

  // Get method, headers, body
  const method = (req.method || 'GET').toUpperCase();
  const authHeader = (req.headers['authorization'] as string) || '';
  const contentType = (req.headers['content-type'] as string) || 'application/json';
  
  // Parse body
  let bodyStr = '';
  if (req.body && typeof req.body === 'object') {
    bodyStr = JSON.stringify(req.body);
  } else if (typeof req.body === 'string') {
    bodyStr = req.body;
  }

  // Build curl command to run inside the sandbox
  // The curl hits the local backend at 127.0.0.1:8000
  const escapedPath = backendPath.replace(/'/g, "'\\''");
  let curlParts = [
    'curl',
    '-s',
    '-w', "'\\n__HTTP_STATUS__:%{http_code}'",
    '-X', method,
    '-H', "'Accept: application/json'",
    '-H', `'Content-Type: ${contentType}'`,
  ];

  // Forward auth header if present (for bearer token auth)
  if (authHeader) {
    curlParts.push('-H', `'Authorization: ${authHeader.replace(/'/g, "'\\''")}'`);
  }

  // Forward body for POST/PUT/PATCH
  if (bodyStr && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const escapedBody = bodyStr.replace(/'/g, "'\\''");
    curlParts.push('-d', `'${escapedBody}'`);
  }

  curlParts.push(`'http://127.0.0.1:8000${escapedPath}'`);

  const curlCmd = curlParts.join(' ');

  // Execute via Daytona API
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

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        errors: [{
          code: 'ProxyError',
          status: '502',
          detail: `Daytona API error: ${response.status} ${errText.slice(0, 200)}`,
        }],
      });
    }

    const data = await response.json();
    const result: string = data.result || '';
    const exitCode: number = data.exitCode || 0;

    // Extract HTTP status code from the curl output
    // Format: <response body>\n__HTTP_STATUS__:<code>
    const statusMatch = result.match(/__HTTP_STATUS__:(\d+)$/);
    const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : 200;
    const responseBody = statusMatch 
      ? result.slice(0, result.length - statusMatch[0].length).replace(/\n$/, '')
      : result;

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(responseBody);
      return res.status(httpStatus).json(parsed);
    } catch {
      // Not JSON — return as text
      return res.status(httpStatus).send(responseBody);
    }
  } catch (err) {
    return res.status(500).json({
      errors: [{
        code: 'ProxyError',
        status: '500',
        detail: `Proxy failed: ${err instanceof Error ? err.message : String(err)}`,
      }],
    });
  }
}
