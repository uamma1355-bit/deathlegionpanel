import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Legion Auth — OAuth2 Integration
 * ================================
 * Implements the full OAuth2 authorization code flow from the Death Legion platform.
 *
 * Flow:
 *   1. User clicks "Connect with Death Legion"
 *   2. Browser opens popup → https://deathlegion.vercel.app/api/oauth/authorize?...
 *   3. User approves → redirected back to /api/legion-auth?code=...&state=...
 *   4. Server exchanges code for access_token (POST /api/oauth/token)
 *   5. Server fetches user info (GET /api/oauth/userinfo)
 *   6. Server creates Pterodactyl user + servers
 *   7. Returns credentials to the user
 *
 * OAuth2 endpoints:
 *   Authorize: GET  https://deathlegion.vercel.app/api/oauth/authorize
 *   Token:     POST https://deathlegion.vercel.app/api/oauth/token
 *   UserInfo:  GET  https://deathlegion.vercel.app/api/oauth/userinfo
 */

const LEGION_AUTH_URL = 'https://deathlegion.vercel.app';
const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

// OAuth2 client credentials — these need to be registered on the Death Legion admin panel
// For now, use env vars. If not set, the page shows a "coming soon" message.
const OAUTH_CLIENT_ID = process.env.DL_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.DL_OAUTH_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = 'https://deathlegionpanel.vercel.app/api/legion-auth';

async function executeOnSandbox(command: string, timeout: number = 120): Promise<string> {
  const url = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DAYTONA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, cwd: '/home/daytona', timeout }),
  });
  const data = await resp.json() as any;
  return data.result || '';
}

async function exchangeCodeForToken(code: string): Promise<any | null> {
  try {
    const resp = await fetch(`${LEGION_AUTH_URL}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        redirect_uri: OAUTH_REDIRECT_URI,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('Token exchange failed:', err);
      return null;
    }
    return await resp.json();
  } catch (e: any) {
    console.error('Token exchange error:', e.message);
    return null;
  }
}

async function getUserInfo(accessToken: string): Promise<any | null> {
  try {
    const resp = await fetch(`${LEGION_AUTH_URL}/api/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function createOrLoginUser(legionUser: any): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const username = legionUser.username || legionUser.email?.split('@')[0] || 'legion_user';
    const email = legionUser.email || `${username}@deathlegion.local`;
    const password = 'DeathLegion2025!';

    const phpScript = `<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\User;
use Pterodactyl\\Models\\Server;
use Pterodactyl\\Models\\Egg;
use Pterodactyl\\Models\\Node;
use Pterodactyl\\Models\\Allocation;
use Pterodactyl\\Models\\Location;
use Pterodactyl\\Models\\ApiKey;
use Pterodactyl\\Services\\Servers\\ServerCreationService;
use Pterodactyl\\Services\\Users\\UserCreationService;
use Illuminate\\Support\\Facades\\Crypt;
use Illuminate\\Support\\Str;

$username = '${username}';
$email = '${email}';
$password = '${password}';

$user = User::where('username', $username)->orWhere('email', $email)->first();
if (!$user) {
    $userService = app(UserCreationService::class);
    $user = $userService->handle([
        'email' => $email, 'username' => $username,
        'name_first' => ucfirst($username), 'name_last' => 'Legion',
        'password' => $password, 'root_admin' => false, 'language' => 'en',
    ]);
    echo "USER_CREATED:" . $user->id . "\\n";
} else {
    echo "USER_EXISTS:" . $user->id . "\\n";
}

$existingServers = Server::where('owner_id', $user->id)->count();
if ($existingServers < 2) {
    $egg = Egg::find(1);
    $location = Location::first();
    $creationService = app(ServerCreationService::class);
    $nodes = Node::orderBy('id')->get();
    for ($i = $existingServers + 1; $i <= 2; $i++) {
        $bestNode = null; $minCount = 999;
        foreach ($nodes as $n) {
            $cnt = Server::where('node_id', $n->id)->count();
            if ($cnt < $minCount) { $minCount = $cnt; $bestNode = $n; }
        }
        if (!$bestNode) break;
        $allocs = Allocation::whereNull('server_id')->where('node_id', $bestNode->id)->orderBy('port')->limit(1)->get();
        if (!isset($allocs[0])) break;
        $name = ucfirst($username) . ' Bot ' . $i;
        $counter = 1;
        while (Server::where('name', $name)->exists()) { $name = ucfirst($username) . ' Bot ' . $i . ' (' . $counter . ')'; $counter++; }
        try {
            $server = $creationService->handle([
                'name' => $name, 'description' => 'WhatsApp Baileys bot for ' . $username,
                'owner_id' => $user->id, 'egg_id' => $egg->id, 'node_id' => $bestNode->id,
                'location_id' => $location->id, 'allocation_id' => $allocs[0]->id,
                'environment' => ['MAIN_FILE' => 'index.js', 'NODE_ARGS' => '', 'NODE_PACKAGES' => '', 'AUTO_UPDATE' => '0', 'GIT_ADDRESS' => '', 'BRANCH' => '', 'USER_UPLOAD' => '1'],
                'memory' => 512, 'swap' => 0, 'disk' => 1024, 'io' => 500, 'cpu' => 100,
                'feature_limits' => ['databases' => 1, 'allocations' => 2, 'backups' => 1],
                'startup' => $egg->startup, 'image' => 'ghcr.io/parkervcp/yolks:nodejs_18',
                'skip_scripts' => true, 'start_on_completion' => false,
            ]);
            $volPath = '/var/lib/pterodactyl/volumes/' . $server->uuid;
            @mkdir($volPath, 0755, true);
            @copy('/opt/deathlegion/bot_template.js', $volPath . '/index.js');
            @copy('/opt/deathlegion/bot_package.json', $volPath . '/package.json');
            @chown($volPath . '/index.js', 'pterodactyl'); @chgrp($volPath . '/index.js', 'pterodactyl');
            @chown($volPath . '/package.json', 'pterodactyl'); @chgrp($volPath . '/package.json', 'pterodactyl');
            echo "SERVER_CREATED:" . $server->uuid . "\\n";
        } catch (\\Exception $e) { echo "SERVER_ERROR:" . $e->getMessage() . "\\n"; }
    }
    shell_exec('sudo bash /opt/deathlegion/regen_nginx_map.sh 2>&1');
}

$identifier = 'ptlc_' . Str::random(11);
$token = Str::random(32);
ApiKey::where('user_id', $user->id)->where('key_type', 1)->delete();
$key = new ApiKey();
$key->user_id = $user->id; $key->key_type = 1; $key->identifier = $identifier;
$key->token = Crypt::encrypt($token); $key->memo = 'legion-oauth';
$key->allowed_ips = null; $key->expires_at = null; $key->save();
echo "TOKEN:" . $identifier . $token . "\\n";
echo "DONE\\n";
`;

    const b64 = Buffer.from(phpScript).toString('base64');
    const result = await executeOnSandbox(
      `echo '${b64}' | base64 -d > /tmp/legion_auth.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/legion_auth.php 2>&1 | grep -v Deprecated`,
      120
    );

    let token = '';
    for (const line of result.trim().split('\n')) {
      if (line.trim().startsWith('TOKEN:')) {
        token = line.trim().substring(6);
      }
    }
    if (token) return { success: true, token };
    return { success: false, error: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Handle OAuth callback: ?code=...&state=...
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (code) {
    // OAuth2 callback — exchange code for token, get user info, create Pterodactyl user
    const tokenData = await exchangeCodeForToken(code);
    if (!tokenData || !tokenData.access_token) {
      return res.status(400).send(`<!DOCTYPE html><html><body style="background:#080808;color:#e5e5e5;font-family:sans-serif;padding:2rem;text-align:center"><h1 style="color:#ef4444">OAuth Error</h1><p>Failed to exchange authorization code.</p><p><a href="/legion-auth" style="color:#e89060">Try again</a></p></body></html>`);
    }

    const userInfo = await getUserInfo(tokenData.access_token);
    if (!userInfo) {
      return res.status(400).send(`<!DOCTYPE html><html><body style="background:#080808;color:#e5e5e5;font-family:sans-serif;padding:2rem;text-align:center"><h1 style="color:#ef4444">OAuth Error</h1><p>Failed to get user info.</p><p><a href="/legion-auth" style="color:#e89060">Try again</a></p></body></html>`);
    }

    const result = await createOrLoginUser(userInfo);
    if (result.success && result.token) {
      const username = userInfo.username || userInfo.email?.split('@')[0] || 'legion_user';
      return res.status(200).send(`<!DOCTYPE html>
<html><head><title>Death Legion — Connected</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#080808;color:#e5e5e5;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:rgba(20,20,20,0.9);border:1px solid rgba(188,110,60,0.2);border-radius:20px;padding:2.5rem;max-width:480px;width:90%;text-align:center}
.logo{font-family:'Cinzel',serif;font-size:1.8rem;font-weight:900;background:linear-gradient(135deg,#bc6e3c,#e89060);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.5rem}
.check{font-size:3rem;color:#22c55e;margin-bottom:1rem}
h2{font-family:'Cinzel',serif;color:#e89060;font-size:1.4rem;margin-bottom:0.5rem}
p{color:#aaa;margin-bottom:1.5rem;line-height:1.6}
.creds{background:rgba(15,15,15,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:1.2rem;margin-bottom:1.5rem;text-align:left}
.creds div{display:flex;justify-content:space-between;padding:0.3rem 0;font-size:0.9rem}
.creds .l{color:#888}.creds .v{color:#e89060;font-family:monospace}
.btn{display:inline-block;padding:0.85rem 2rem;background:linear-gradient(135deg,#bc6e3c,#e89060);color:#fff;text-decoration:none;border-radius:10px;font-weight:600;transition:all 0.2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(188,110,60,0.3)}
</style></head><body>
<div class="card">
  <div class="logo">Death Legion</div>
  <div class="check">✓</div>
  <h2>Welcome, ${username}!</h2>
  <p>Your Death Legion ID is connected. Your bot servers are ready.</p>
  <div class="creds">
    <div><span class="l">Panel URL:</span> <span class="v">deathlegionpanel.vercel.app</span></div>
    <div><span class="l">Username:</span> <span class="v">${username}</span></div>
    <div><span class="l">Password:</span> <span class="v">DeathLegion2025!</span></div>
    <div><span class="l">Member #:</span> <span class="v">${userInfo.memberNumber || 'N/A'}</span></div>
  </div>
  <a href="/" class="btn">Go to Panel →</a>
</div>
</body></html>`);
    }
    return res.status(500).send(`<!DOCTYPE html><html><body style="background:#080808;color:#e5e5e5;font-family:sans-serif;padding:2rem;text-align:center"><h1 style="color:#ef4444">Error</h1><p>${result.error || 'Failed to create user'}</p><p><a href="/legion-auth" style="color:#e89060">Try again</a></p></body></html>`);
  }

  // GET: Show the Legion Auth page with "Connect with Death Legion" button
  if (req.method === 'GET') {
    // If no OAuth client ID configured, show setup message
    if (!OAUTH_CLIENT_ID) {
      return res.status(200).send(`<!DOCTYPE html>
<html><head><title>Death Legion — Connect</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#080808;color:#e5e5e5;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:rgba(20,20,20,0.9);border:1px solid rgba(188,110,60,0.2);border-radius:20px;padding:2.5rem;max-width:480px;width:90%;text-align:center}
.logo{font-family:'Cinzel',serif;font-size:1.8rem;font-weight:900;background:linear-gradient(135deg,#bc6e3c,#e89060);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.5rem}
.subtitle{color:#666;font-size:0.85rem;margin-bottom:2rem}
.btn{display:inline-block;padding:0.85rem 2rem;background:linear-gradient(135deg,#bc6e3c,#e89060);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:1rem;transition:all 0.2s;margin:0.5rem}
.btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(188,110,60,0.3)}
.btn-outline{background:transparent;border:1px solid rgba(188,110,60,0.3);color:#e89060}
.info{margin-top:1.5rem;color:#666;font-size:0.8rem;line-height:1.6}
.info a{color:#e89060;text-decoration:none}
</style></head><body>
<div class="card">
  <div class="logo">Death Legion</div>
  <div class="subtitle">Bot Hosting Platform</div>
  <p style="color:#aaa;margin-bottom:1.5rem;font-size:0.9rem">Login with your Death Legion ID or apply directly.</p>
  <a href="/apply" class="btn">Apply Now</a>
  <a href="/" class="btn btn-outline">Go to Panel</a>
  <div class="info">
    <p>Death Legion OAuth is being configured.</p>
    <p style="margin-top:0.5rem">Use the apply form to get instant access.</p>
  </div>
</div>
</body></html>`);
    }

    // Generate state for CSRF protection
    const state = Math.random().toString(36).slice(2);
    const authUrl = `${LEGION_AUTH_URL}/api/oauth/authorize?response_type=code&client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&scope=profile&state=${state}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Connect</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:#080808; color:#e5e5e5; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .container { max-width:480px; width:100%; padding:2rem; }
    .card { background:rgba(20,20,20,0.9); border:1px solid rgba(188,110,60,0.2); border-radius:20px; padding:2.5rem; text-align:center; }
    .logo { font-family:'Cinzel',serif; font-size:1.8rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c,#e89060); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.5rem; }
    .subtitle { color:#666; font-size:0.85rem; margin-bottom:2rem; }
    .btn { display:inline-block; padding:0.9rem 2rem; background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; text-decoration:none; border-radius:12px; font-weight:600; font-size:1rem; border:none; cursor:pointer; transition:all 0.2s; }
    .btn:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(188,110,60,0.3); }
    .btn-outline { background:transparent; border:1px solid rgba(188,110,60,0.3); color:#e89060; margin-top:1rem; }
    .info { margin-top:1.5rem; color:#666; font-size:0.8rem; line-height:1.6; }
    .info a { color:#e89060; text-decoration:none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">Death Legion</div>
      <div class="subtitle">Bot Hosting Platform</div>
      <p style="color:#aaa;margin-bottom:1.5rem;font-size:0.9rem">Connect with your Death Legion ID to get instant access to your bot servers.</p>
      <a href="${authUrl}" class="btn">Connect with Death Legion</a>
      <br>
      <a href="/apply" class="btn btn-outline">Apply without Legion ID</a>
      <div class="info">
        <p>Your Death Legion ID works across all Legion apps.</p>
        <p style="margin-top:0.5rem">Don't have an ID? <a href="${LEGION_AUTH_URL}" target="_blank">Register here</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
    return res.status(200).send(html);
  }

  // POST: Create/login user from Legion Auth user data (for popup flow)
  if (req.method === 'POST') {
    const { user: legionUser } = req.body || {};
    if (!legionUser || !legionUser.email) {
      return res.status(400).json({ error: 'Missing user data' });
    }
    const result = await createOrLoginUser(legionUser);
    if (result.success && result.token) {
      return res.status(200).json({
        success: true,
        user: {
          username: legionUser.username || legionUser.email.split('@')[0],
          email: legionUser.email,
          role: legionUser.role,
          memberNumber: legionUser.memberNumber,
        },
        panelUrl: 'https://deathlegionpanel.vercel.app',
        login: {
          username: legionUser.username || legionUser.email.split('@')[0],
          password: 'DeathLegion2025!',
        },
      });
    }
    return res.status(500).json({ error: result.error || 'Failed to create user' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export const config = {
  api: { bodyParser: true, sizeLimit: '10mb' },
  maxDuration: 300,
};
