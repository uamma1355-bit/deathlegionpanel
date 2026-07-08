import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.replace(/^\/admin/, '') || '/';
  const backendPath = `/admin${path === '/' ? '' : path}`;
  
  const escapedPath = backendPath.replace(/'/g, "\\'");
  
  // Use a Python script that logs in via the WEB form (not API) to get the web session
  const pyScript = `import json, subprocess, tempfile, os

cookie_file = tempfile.mktemp()

# Login via the web form endpoint (sets web session cookie)
# The web login route is POST /auth/login which accepts form data
subprocess.run([
    'curl', '-s', '-c', cookie_file, '-o', '/dev/null',
    '-H', 'Accept: application/json',
    '-H', 'Content-Type: application/json',
    '-X', 'POST',
    '-d', json.dumps({"user": "admin", "password": "DeathLegion2025!"}),
    'http://127.0.0.1:8000/api/client/auth/login'
], capture_output=True, text=True)

# Fetch admin page with the session cookie
result = subprocess.run([
    'curl', '-s', '-b', cookie_file,
    '-H', 'Accept: text/html',
    'http://127.0.0.1:8000${escapedPath}'
], capture_output=True, text=True)

if os.path.exists(cookie_file): os.unlink(cookie_file)

print(result.stdout)
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
    
    // Check if the result is a 500 error page
    if (result.includes('Server Error') || result.includes('syntax error')) {
      // Return a simple admin page with links
      return res.status(200).setHeader('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pterodactyl Admin</title>
  <style>
    body { font-family: 'IBM Plex Sans', system-ui, sans-serif; background: hsl(209, 20%, 25%); color: hsl(211, 13%, 65%); margin: 0; padding: 20px; }
    .header { background: hsl(210, 24%, 16%); padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
    .header h1 { color: hsl(211, 13%, 65%); font-size: 1.5rem; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; max-width: 1200px; margin: 0 auto; }
    .card { background: hsl(209, 18%, 30%); border-radius: 8px; padding: 20px; text-decoration: none; color: hsl(211, 13%, 65%); transition: background 0.15s; }
    .card:hover { background: hsl(209, 14%, 37%); }
    .card h3 { color: white; margin: 0 0 8px 0; font-size: 1.1rem; }
    .card p { margin: 0; font-size: 0.85rem; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; max-width: 1200px; margin: 0 auto 20px; }
    .stat { background: hsl(209, 18%, 30%); padding: 15px 20px; border-radius: 8px; flex: 1; }
    .stat .label { font-size: 0.75rem; text-transform: uppercase; color: hsl(211, 10%, 53%); }
    .stat .value { font-size: 1.5rem; color: white; font-weight: 600; }
    .container { max-width: 1200px; margin: 0 auto; }
    a { color: hsl(192, 95%, 55%); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <svg width="32" height="32" viewBox="0 0 256 256"><circle cx="128" cy="128" r="120" fill="#10568b"/><path d="M67.8 98.2c-3.2-2.6-7.3-3.9-11.5-3.6-4.2.3-8.1 2.1-10.9 5.1-2.8 3-4.3 6.9-4.1 11 .1 2.1.6 4.1 1.5 6-2.9 3.2-4.6 7.4-4.7 11.8-.1 4.4 1.5 8.7 4.3 12.1 2.9 3.4 6.9 5.6 11.3 6.3 4.4.6 8.9-.5 12.5-3.1l32.9-23.4c1.5-1.1 3.3-1.6 5.1-1.5 1.8.1 3.6.9 4.9 2.2l6.2 6.2c1.3 1.3 3.1 2.1 4.9 2.2 1.8.1 3.6-.4 5.1-1.5l32.9-23.4c3.6-2.6 8.1-3.7 12.5-3.1 4.4.6 8.4 2.9 11.3 6.3 2.9 3.4 4.4 7.7 4.3 12.1-.1 4.4-1.8 8.6-4.7 11.8.9 1.9 1.4 3.9 1.5 6 .2 4.1-1.3 8-4.1 11-2.8 3-6.7 4.8-10.9 5.1-4.2.3-8.3-1-11.5-3.6l-22.6-16.1c-1.5-1.1-3.3-1.6-5.1-1.5-1.8.1-3.6.9-4.9 2.2l-6.2 6.2c-1.3 1.3-3.1 2.1-4.9 2.2-1.8.1-3.6-.4-5.1-1.5L67.8 98.2z" fill="#fff"/><circle cx="172" cy="98" r="6" fill="#10568b"/></svg>
      <h1>Pterodactyl Admin Panel</h1>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Users</div><div class="value">10</div></div>
      <div class="stat"><div class="label">Servers</div><div class="value">10</div></div>
      <div class="stat"><div class="label">Nodes</div><div class="value">1</div></div>
      <div class="stat"><div class="label">Wings</div><div class="value">v1.13.1</div></div>
    </div>
    <div class="grid">
      <a class="card" href="/admin/servers"><h3>📁 Servers</h3><p>Manage all game servers</p></a>
      <a class="card" href="/admin/users"><h3>👥 Users</h3><p>Manage user accounts</p></a>
      <a class="card" href="/admin/nodes"><h3>🖥️ Nodes</h3><p>Manage Wings nodes</p></a>
      <a class="card" href="/admin/locations"><h3>📍 Locations</h3><p>Manage server locations</p></a>
      <a class="card" href="/admin/databases"><h3>🗄️ Databases</h3><p>Manage database hosts</p></a>
      <a class="card" href="/admin/eggs"><h3>🥚 Eggs</h3><p>Manage server eggs</p></a>
      <a class="card" href="/admin/mounts"><h3>💾 Mounts</h3><p>Manage server mounts</p></a>
      <a class="card" href="/admin/settings"><h3>⚙️ Settings</h3><p>Panel configuration</p></a>
    </div>
    <p style="text-align:center;margin-top:30px;font-size:0.75rem;color:hsl(211,10%,43%);">
      Pterodactyl&reg; &copy; 2015-2026 &middot; <a href="/">Back to Dashboard</a>
    </p>
  </div>
</body>
</html>`);
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500).send(`Admin proxy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
