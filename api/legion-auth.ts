import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Legion Auth Integration
 * =======================
 * Verifies a Death Legion ID session and auto-creates/logs in
 * the user in the Pterodactyl Panel.
 *
 * Flow:
 *   1. User visits /legion-auth
 *   2. Page checks if user has a Death Legion session (via /api/session on applydeathlegionteam.vercel.app)
 *   3. If yes → creates Pterodactyl user + servers (if not exists) → logs them in
 *   4. If no → shows "Login with Death Legion ID" button → redirects to applydeathlegionteam.vercel.app
 *
 * The Death Legion platform URL: https://applydeathlegionteam.vercel.app
 * Session endpoint: GET /api/session (returns user data or null)
 */

const LEGION_AUTH_URL = 'https://applydeathlegionteam.vercel.app';
const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

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

async function getLegionUser(sessionCookie: string): Promise<any | null> {
  try {
    const resp = await fetch(`${LEGION_AUTH_URL}/api/session`, {
      headers: {
        'Cookie': `next-auth.session-token=${sessionCookie}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    return data.user || null;
  } catch {
    return null;
  }
}

async function createOrLoginUser(legionUser: any): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const username = legionUser.username || legionUser.email?.split('@')[0] || 'legion_user';
    const email = legionUser.email || `${username}@deathlegion.local`;
    const password = 'DeathLegion2025!'; // Standard password for all Legion Auth users

    // PHP script that:
    // 1. Finds or creates the Pterodactyl user
    // 2. Creates 2 servers if the user doesn't have any
    // 3. Creates an API token for the user
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

// Find or create user
$user = User::where('username', $username)->orWhere('email', $email)->first();
if (!$user) {
    $userService = app(UserCreationService::class);
    $user = $userService->handle([
        'email' => $email,
        'username' => $username,
        'name_first' => ucfirst($username),
        'name_last' => 'Legion',
        'password' => $password,
        'root_admin' => false,
        'language' => 'en',
    ]);
    echo "USER_CREATED:" . $user->id . "\\n";
} else {
    echo "USER_EXISTS:" . $user->id . "\\n";
}

// Check if user has servers
$existingServers = Server::where('owner_id', $user->id)->count();
if ($existingServers < 2) {
    $egg = Egg::find(1);
    $location = Location::first();
    $creationService = app(ServerCreationService::class);
    
    // Pick node with fewest servers
    $nodes = Node::orderBy('id')->get();
    $needed = 2 - $existingServers;
    
    for ($i = $existingServers + 1; $i <= 2; $i++) {
        $bestNode = null;
        $minCount = 999;
        foreach ($nodes as $n) {
            $cnt = Server::where('node_id', $n->id)->count();
            if ($cnt < $minCount) { $minCount = $cnt; $bestNode = $n; }
        }
        if (!$bestNode) break;
        
        $allocs = Allocation::whereNull('server_id')->where('node_id', $bestNode->id)->orderBy('port')->limit(1)->get();
        if (!isset($allocs[0])) break;
        
        $name = ucfirst($username) . ' Bot ' . $i;
        $counter = 1;
        while (Server::where('name', $name)->exists()) {
            $name = ucfirst($username) . ' Bot ' . $i . ' (' . $counter . ')';
            $counter++;
        }
        
        try {
            $server = $creationService->handle([
                'name' => $name,
                'description' => 'WhatsApp Baileys bot for ' . $username,
                'owner_id' => $user->id,
                'egg_id' => $egg->id,
                'node_id' => $bestNode->id,
                'location_id' => $location->id,
                'allocation_id' => $allocs[0]->id,
                'environment' => [
                    'MAIN_FILE' => 'index.js', 'NODE_ARGS' => '', 'NODE_PACKAGES' => '',
                    'AUTO_UPDATE' => '0', 'GIT_ADDRESS' => '', 'BRANCH' => '', 'USER_UPLOAD' => '1',
                ],
                'memory' => 512, 'swap' => 0, 'disk' => 1024, 'io' => 500, 'cpu' => 100,
                'feature_limits' => ['databases' => 1, 'allocations' => 2, 'backups' => 1],
                'startup' => $egg->startup,
                'image' => 'ghcr.io/parkervcp/yolks:nodejs_18',
                'skip_scripts' => true,
                'start_on_completion' => false,
            ]);
            
            // Install bot template
            $volPath = '/var/lib/pterodactyl/volumes/' . $server->uuid;
            @mkdir($volPath, 0755, true);
            @copy('/opt/deathlegion/bot_template.js', $volPath . '/index.js');
            @copy('/opt/deathlegion/bot_package.json', $volPath . '/package.json');
            @chown($volPath . '/index.js', 'pterodactyl');
            @chgrp($volPath . '/index.js', 'pterodactyl');
            @chown($volPath . '/package.json', 'pterodactyl');
            @chgrp($volPath . '/package.json', 'pterodactyl');
            
            echo "SERVER_CREATED:" . $server->uuid . "\\n";
        } catch (\\Exception $e) {
            echo "SERVER_ERROR:" . $e->getMessage() . "\\n";
        }
    }
    
    // Regenerate nginx map
    shell_exec('sudo bash /opt/deathlegion/regen_nginx_map.sh 2>&1');
}

// Create API token for the user
$identifier = 'ptlc_' . Str::random(11);
$token = Str::random(32);
ApiKey::where('user_id', $user->id)->where('key_type', 1)->delete();
$key = new ApiKey();
$key->user_id = $user->id;
$key->key_type = 1;
$key->identifier = $identifier;
$key->token = Crypt::encrypt($token);
$key->memo = 'legion-auth';
$key->allowed_ips = null;
$key->expires_at = null;
$key->save();

echo "TOKEN:" . $identifier . $token . "\\n";
echo "USER_ID:" . $user->id . "\\n";
echo "USERNAME:" . $user->username . "\\n";
echo "DONE\\n";
`;

    const b64 = Buffer.from(phpScript).toString('base64');
    const result = await executeOnSandbox(
      `echo '${b64}' | base64 -d > /tmp/legion_auth.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/legion_auth.php 2>&1 | grep -v Deprecated`,
      120
    );

    // Parse result
    let token = '';
    for (const line of result.trim().split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('TOKEN:')) {
        token = trimmed.substring(6);
      }
    }

    if (token) {
      return { success: true, token };
    }
    return { success: false, error: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET: Show the Legion Auth page
  if (req.method === 'GET') {
    const sessionCookie = (req.query.session as string) || (req.headers['x-legion-session'] as string) || '';

    if (sessionCookie) {
      // Verify the session and create/login user
      const legionUser = await getLegionUser(sessionCookie);
      if (legionUser) {
        const result = await createOrLoginUser(legionUser);
        if (result.success && result.token) {
          return res.status(200).json({
            success: true,
            user: {
              username: legionUser.username,
              email: legionUser.email,
              role: legionUser.role,
            },
            panelToken: result.token,
            panelUrl: 'https://deathlegionpanel.vercel.app',
            login: {
              username: legionUser.username || legionUser.email?.split('@')[0],
              password: 'DeathLegion2025!',
            },
          });
        }
      }
      return res.status(401).json({ error: 'Invalid or expired Legion session' });
    }

    // Show the login page
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Login with Legion ID</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:#080808; color:#e5e5e5; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .container { max-width:480px; width:100%; padding:2rem; }
    .card { background:rgba(20,20,20,0.9); border:1px solid rgba(188,110,60,0.2); border-radius:20px; padding:2.5rem; text-align:center; }
    .logo { font-family:'Cinzel',serif; font-size:1.8rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c 0%,#e89060 50%,#bc6e3c 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.5rem; }
    .subtitle { color:#666; font-size:0.85rem; margin-bottom:2rem; }
    .btn { display:inline-block; padding:0.9rem 2rem; background:linear-gradient(135deg,#bc6e3c 0%,#e89060 100%); color:#fff; text-decoration:none; border-radius:12px; font-weight:600; font-size:1rem; border:none; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s; }
    .btn:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(188,110,60,0.3); }
    .info { margin-top:1.5rem; color:#666; font-size:0.8rem; line-height:1.6; }
    .info a { color:#e89060; text-decoration:none; }
    .status { margin-top:1rem; padding:0.8rem; border-radius:8px; font-size:0.85rem; display:none; }
    .status.success { display:block; background:rgba(34,197,94,0.1); color:#22c55e; border:1px solid rgba(34,197,94,0.2); }
    .status.error { display:block; background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }
    .credentials { margin-top:1.5rem; padding:1rem; background:rgba(188,110,60,0.08); border:1px solid rgba(188,110,60,0.15); border-radius:10px; font-family:monospace; font-size:0.85rem; text-align:left; display:none; }
    .credentials.show { display:block; }
    .credentials div { margin:0.3rem 0; }
    .credentials .label { color:#888; }
    .credentials .value { color:#e89060; }
    .spinner { display:inline-block; width:20px; height:20px; border:2px solid rgba(255,255,255,0.2); border-top-color:#e89060; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:0.5rem; vertical-align:middle; }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">Death Legion</div>
      <div class="subtitle">Bot Hosting Platform</div>
      <p style="color:#aaa;margin-bottom:1.5rem;font-size:0.9rem">Login with your Death Legion ID to access your bot servers.</p>
      <button class="btn" id="loginBtn" onclick="loginWithLegion()">
        <span id="btnText">Login with Death Legion ID</span>
      </button>
      <div class="status" id="status"></div>
      <div class="credentials" id="credentials"></div>
      <div class="info">
        <p>Don't have a Death Legion ID? <a href="${LEGION_AUTH_URL}" target="_blank">Register here</a></p>
        <p style="margin-top:0.5rem">Your Death Legion ID works across all Legion apps.</p>
        <p style="margin-top:0.5rem;color:#555;font-size:0.75rem">Or apply directly with the form below.</p>
      </div>
      <div style="margin-top:1rem;text-align:center">
        <a href="/apply" style="color:#e89060;text-decoration:none;font-size:0.85rem">Apply without Legion ID →</a>
      </div>
    </div>
  </div>
  <script>
    async function loginWithLegion() {
      const btn = document.getElementById('loginBtn');
      const btnText = document.getElementById('btnText');
      const status = document.getElementById('status');
      const creds = document.getElementById('credentials');

      btn.disabled = true;
      btnText.innerHTML = '<span class="spinner"></span>Connecting to Death Legion...';
      status.className = 'status';

      try {
        // Try to check Death Legion session via direct fetch
        let sessionData = null;
        try {
          const sessionRes = await fetch('${LEGION_AUTH_URL}/api/session', {
            credentials: 'include',
            mode: 'cors',
          });
          if (sessionRes.ok) {
            sessionData = await sessionRes.json();
          }
        } catch (corsErr) {
          // CORS failed — redirect to Death Legion login
          status.className = 'status error';
          status.textContent = 'Redirecting to Death Legion login...';
          setTimeout(() => {
            window.location.href = '${LEGION_AUTH_URL}/?redirect=' + encodeURIComponent(window.location.href);
          }, 1500);
          return;
        }

        if (!sessionData || !sessionData.user) {
          // Not logged in — redirect to Death Legion
          status.className = 'status error';
          status.textContent = 'You need to log in to Death Legion first. Redirecting...';
          setTimeout(() => {
            window.location.href = '${LEGION_AUTH_URL}/?redirect=' + encodeURIComponent(window.location.href);
          }, 2000);
          return;
        }

        btnText.innerHTML = '<span class="spinner"></span>Creating your bot servers...';

        // Call our API to create/login the user
        const res = await fetch('/api/legion-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: sessionData.user })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = 'Welcome, ' + data.user.username + '! Your bot servers are ready.';
          creds.className = 'credentials show';
          creds.innerHTML = '<div><span class="label">Panel URL:</span> <span class="value">' + data.panelUrl + '</span></div>' +
            '<div><span class="label">Username:</span> <span class="value">' + data.login.username + '</span></div>' +
            '<div><span class="label">Password:</span> <span class="value">' + data.login.password + '</span></div>' +
            '<div style="margin-top:0.8rem"><a href="' + data.panelUrl + '" style="color:#e89060">Go to Panel →</a></div>';
          btnText.textContent = 'Done!';
        } else {
          status.className = 'status error';
          status.textContent = 'Error: ' + (data.error || 'Unknown error');
          btn.disabled = false;
          btnText.textContent = 'Login with Death Legion ID';
        }
      } catch (e) {
        status.className = 'status error';
        status.textContent = 'Error: ' + e.message;
        btn.disabled = false;
        btnText.textContent = 'Login with Death Legion ID';
      }
    }

    // Auto-check session on load (best effort)
    fetch('${LEGION_AUTH_URL}/api/session', { credentials: 'include', mode: 'cors' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.user) {
          document.getElementById('btnText').textContent = 'Continue as ' + data.user.username;
        }
      })
      .catch(() => {
        // CORS blocked — user might not be logged in or cross-origin not allowed
      });
  </script>
</body>
</html>`;
    return res.status(200).send(html);
  }

  // POST: Create/login user from Legion Auth session
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
        },
        panelToken: result.token,
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
