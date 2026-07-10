import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Legion Auth — Working Integration
 * =================================
 * The Death Legion platform's OAuth2 endpoints are currently broken (500 error).
 * NextAuth has a configuration error (?error=Configuration).
 * No CORS headers on /api/session (cross-origin browser requests blocked).
 *
 * Working approach:
 *   1. User clicks "Connect with Death Legion" → opens deathlegion.vercel.app in new tab
 *   2. User registers/logs in on deathlegion.vercel.app
 *   3. User comes back and enters their Death Legion username
 *   4. We create a Pterodactyl user + 2 bot servers with that username
 *   5. Show panel credentials
 *
 * When the Death Legion platform fixes their OAuth, we can switch back to
 * the proper OAuth2 authorization code flow.
 */

const LEGION_AUTH_URL = 'https://deathlegion.vercel.app';
const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

// OAuth2 credentials (for when the Death Legion platform fixes their OAuth)
const OAUTH_CLIENT_ID = process.env.DL_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.DL_OAUTH_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = 'https://deathlegionpanel.vercel.app/api/legion-auth';

async function executeOnSandbox(command: string, timeout: number = 120): Promise<string> {
  const url = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
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
        grant_type: 'authorization_code', code,
        client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET,
        redirect_uri: OAUTH_REDIRECT_URI,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

async function getUserInfo(accessToken: string): Promise<any | null> {
  try {
    const resp = await fetch(`${LEGION_AUTH_URL}/api/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

async function createOrLoginUser(username: string, email?: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const userEmail = email || `${cleanUsername}@deathlegion.dev`;
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

$username = '${cleanUsername}';
$email = '${userEmail}';
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
$key->token = Crypt::encrypt($token); $key->memo = 'legion-auth';
$key->allowed_ips = null; $key->expires_at = null; $key->save();
echo "TOKEN:" . $identifier . $token . "\\n";
echo "USERNAME:" . $user->username . "\\n";
echo "DONE\\n";
`;

    const b64 = Buffer.from(phpScript).toString('base64');
    const result = await executeOnSandbox(
      `echo '${b64}' | base64 -d > /tmp/legion_auth.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/legion_auth.php 2>&1 | grep -v Deprecated`,
      120
    );

    let token = '';
    let finalUsername = cleanUsername;
    for (const line of result.trim().split('\n')) {
      if (line.trim().startsWith('TOKEN:')) token = line.trim().substring(6);
      if (line.trim().startsWith('USERNAME:')) finalUsername = line.trim().substring(9);
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

  // Handle OAuth callback (for when OAuth is fixed)
  const code = req.query.code as string;
  if (code) {
    const tokenData = await exchangeCodeForToken(code);
    if (tokenData && tokenData.access_token) {
      const userInfo = await getUserInfo(tokenData.access_token);
      if (userInfo) {
        const result = await createOrLoginUser(userInfo.username, userInfo.email);
        if (result.success) {
          const username = userInfo.username || 'legion_user';
          return res.status(200).send(renderSuccessPage(username, userInfo.memberNumber));
        }
      }
    }
    // OAuth failed — redirect to the manual flow
    return res.redirect(302, '/legion-auth?error=oauth_failed');
  }

  // POST: Create user from username
  if (req.method === 'POST') {
    const { username, email } = req.body || {};
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    const result = await createOrLoginUser(username, email);
    if (result.success && result.token) {
      return res.status(200).json({
        success: true,
        username: username.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        panelUrl: 'https://deathlegionpanel.vercel.app',
        login: { username: username.toLowerCase().replace(/[^a-z0-9_-]/g, ''), password: 'DeathLegion2025!' },
      });
    }
    return res.status(500).json({ error: result.error || 'Failed to create user' });
  }

  // GET: Show the page
  const oauthError = req.query.error === 'oauth_failed';
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
    .btn { display:inline-block; padding:0.9rem 2rem; background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; text-decoration:none; border-radius:12px; font-weight:600; font-size:1rem; border:none; cursor:pointer; transition:all 0.2s; width:100%; }
    .btn:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(188,110,60,0.3); }
    .btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
    .btn-outline { background:transparent; border:1px solid rgba(188,110,60,0.3); color:#e89060; margin-top:1rem; }
    .divider { display:flex; align-items:center; margin:1.5rem 0; color:#555; font-size:0.8rem; }
    .divider::before, .divider::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.08); }
    .divider span { padding:0 0.75rem; }
    .form-group { margin-bottom:1rem; text-align:left; }
    .form-group label { display:block; font-size:0.85rem; color:#aaa; margin-bottom:0.4rem; }
    .form-group input { width:100%; padding:0.75rem 1rem; background:rgba(15,15,15,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#fff; font-size:0.95rem; font-family:'Inter',sans-serif; }
    .form-group input:focus { outline:none; border-color:#bc6e3c; box-shadow:0 0 0 3px rgba(188,110,60,0.15); }
    .status { margin-top:1rem; padding:0.8rem; border-radius:8px; font-size:0.85rem; display:none; }
    .status.success { display:block; background:rgba(34,197,94,0.1); color:#22c55e; border:1px solid rgba(34,197,94,0.2); }
    .status.error { display:block; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }
    .creds { margin-top:1rem; padding:1rem; background:rgba(15,15,15,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:10px; font-family:monospace; font-size:0.85rem; text-align:left; display:none; }
    .creds.show { display:block; }
    .creds div { margin:0.3rem 0; }
    .creds .l { color:#888; }
    .creds .v { color:#e89060; }
    .spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.2); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:0.5rem; vertical-align:middle; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .info { margin-top:1.5rem; color:#666; font-size:0.8rem; line-height:1.6; }
    .info a { color:#e89060; text-decoration:none; }
    .alert { background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); color:#f59e0b; padding:0.75rem 1rem; border-radius:8px; font-size:0.8rem; margin-bottom:1rem; display:none; }
    .alert.show { display:block; }
    .beta-badge { position:fixed; top:12px; right:12px; z-index:999; background:linear-gradient(135deg,#bc6e3c,#e89060); color:#fff; padding:4px 12px; border-radius:20px; font-size:0.7rem; font-weight:700; text-transform:uppercase; box-shadow:0 2px 10px rgba(188,110,60,0.3); pointer-events:none; }
    .steps { text-align:left; margin:1rem 0; font-size:0.85rem; color:#888; line-height:1.8; }
    .steps div { padding:0.2rem 0; }
    .steps .num { display:inline-block; width:20px; height:20px; background:rgba(188,110,60,0.2); color:#e89060; border-radius:50%; text-align:center; line-height:20px; font-size:0.75rem; margin-right:0.5rem; }
  </style>
</head>
<body>
  <div class="beta-badge">BETA</div>
  <div class="container">
    <div class="card">
      <div class="logo">Death Legion</div>
      <div class="subtitle">Bot Hosting Platform</div>

      ${oauthError ? '<div class="alert show">OAuth login failed. Use the manual login below.</div>' : ''}

      <div class="steps">
        <div><span class="num">1</span> Click "Open Death Legion" to register/login</div>
        <div><span class="num">2</span> Come back and enter your Death Legion username</div>
        <div><span class="num">3</span> Click "Create My Account" to get your bot servers</div>
      </div>

      <a href="${LEGION_AUTH_URL}" target="_blank" class="btn">Open Death Legion</a>

      <div class="divider"><span>OR ENTER YOUR USERNAME</span></div>

      <form id="legionForm" onsubmit="return false">
        <div class="form-group">
          <label>Death Legion Username</label>
          <input type="text" id="dlUsername" placeholder="your DL username" required minlength="3" />
        </div>
        <div class="form-group">
          <label>Email (optional)</label>
          <input type="email" id="dlEmail" placeholder="your@email.com" />
        </div>
        <button type="submit" class="btn" id="createBtn" onclick="createAccount()">
          Create My Account
        </button>
      </form>

      <div class="status" id="status"></div>
      <div class="creds" id="creds"></div>

      <div class="divider"><span>OR</span></div>

      <a href="/apply" class="btn btn-outline">Apply Without Legion ID</a>

      <div class="info">
        <p>Your Death Legion ID works across all Legion apps.</p>
        <p style="margin-top:0.5rem">Don't have an ID? <a href="${LEGION_AUTH_URL}" target="_blank">Register at Death Legion</a></p>
      </div>
    </div>
  </div>

  <script>
    async function createAccount() {
      const btn = document.getElementById('createBtn');
      const status = document.getElementById('status');
      const creds = document.getElementById('creds');
      const username = document.getElementById('dlUsername').value.trim();
      const email = document.getElementById('dlEmail').value.trim();

      if (!username || username.length < 3) {
        status.className = 'status error';
        status.textContent = 'Please enter your Death Legion username (min 3 characters)';
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Creating your account...';
      status.className = 'status';

      try {
        const res = await fetch('/api/legion-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email: email || undefined })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = 'Welcome, ' + data.username + '! Your bot servers are ready.';
          creds.className = 'creds show';
          creds.innerHTML =
            '<div><span class="l">Panel URL:</span> <span class="v">' + data.panelUrl + '</span></div>' +
            '<div><span class="l">Username:</span> <span class="v">' + data.login.username + '</span></div>' +
            '<div><span class="l">Password:</span> <span class="v">' + data.login.password + '</span></div>' +
            '<div style="margin-top:0.8rem"><a href="' + data.panelUrl + '" style="color:#e89060">Go to Panel →</a></div>';
          btn.textContent = 'Done!';
        } else {
          status.className = 'status error';
          status.textContent = 'Error: ' + (data.error || 'Unknown error');
          btn.disabled = false;
          btn.textContent = 'Create My Account';
        }
      } catch (e) {
        status.className = 'status error';
        status.textContent = 'Error: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'Create My Account';
      }
    }
  </script>
</body>
</html>`;
  return res.status(200).send(html);
}

function renderSuccessPage(username: string, memberNumber?: string): string {
  return `<!DOCTYPE html>
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
    ${memberNumber ? `<div><span class="l">Member #:</span> <span class="v">${memberNumber}</span></div>` : ''}
  </div>
  <a href="/" class="btn">Go to Panel →</a>
</div>
</body></html>`;
}

export const config = {
  api: { bodyParser: true, sizeLimit: '10mb' },
  maxDuration: 300,
};
