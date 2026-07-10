import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const path = pathParts.filter(Boolean).join('/');
  const backendPath = `/api/${path}`;

  const method = (req.method || 'GET').toUpperCase();
  const authHeader = (req.headers['authorization'] as string) || '';
  const contentType = (req.headers['content-type'] as string) || 'application/json';

  let bodyStr = '';
  if (req.body && typeof req.body === 'object') {
    bodyStr = JSON.stringify(req.body);
  } else if (typeof req.body === 'string') {
    bodyStr = req.body;
  }

  const escapedPath = backendPath.replace(/'/g, "'\\''");
  let curlParts = [
    'curl', '-s',
    '-X', method,
    '-H', "'Accept: application/json'",
    '-H', `'Content-Type: ${contentType}'`,
  ];

  if (authHeader) {
    curlParts.push('-H', `'Authorization: ${authHeader.replace(/'/g, "'\\''")}'`);
  }

  if (bodyStr && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const escapedBody = bodyStr.replace(/'/g, "'\\''");
    curlParts.push('-d', `'${escapedBody}'`);
  }

  curlParts.push(`'http://127.0.0.1:8000${escapedPath}'`);

  const curlCmd = curlParts.join(' ');

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

    // Try to parse as JSON (most API responses are JSON)
    try {
      const parsed = JSON.parse(result);
      return res.status(200).json(parsed);
    } catch {
      // Not JSON — return as text
      return res.status(200).send(result);
    }
  } catch (err) {
    return res.status(500).json({
      errors: [{
        code: 'ProxyError',
        detail: `Proxy failed: ${err instanceof Error ? err.message : String(err)}`,
      }],
    });
  }
}
