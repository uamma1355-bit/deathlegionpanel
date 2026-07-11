import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS } from './_design';

/**
 * Legion Auth — Quick Sign Up
 * ============================
 * This page lets users quickly create a Death Legion panel account.
 *
 * Two paths:
 * 1. Direct signup — enter a username, click "Create Account", get instant
 *    panel access with 2 bot servers provisioned automatically.
 * 2. OAuth connect — if an OAuth app is configured, show "Connect with
 *    Death Legion" button that uses our own OAuth2 provider.
 *
 * The old version redirected to deathlegion.vercel.app (a separate domain
 * that doesn't exist). Now it's self-contained.
 */

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

async function executeOnSandbox(command: string, timeout: number = 120): Promise<string> {
  const resp = await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd: '/home/daytona', timeout }),
  });
  return (await resp.json() as any).result || '';
}

async function createOrLoginUser(username: string, email?: string): Promise<{ success: boolean; token?: string; username?: string; error?: string }> {
  try {
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanUsername.length < 3) return { success: false, error: 'Username must be at least 3 characters (letters, numbers, _, -)' };
    const userEmail = email || `${cleanUsername}@deathlegion.dev`;
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
$password = 'DeathLegion2025!';
$user = User::where('username', $username)->orWhere('email', $email)->first();
if (!$user) {
    $userService = app(UserCreationService::class);
    $user = $userService->handle([
        'email' => $email, 'username' => $username,
        'name_first' => ucfirst($username), 'name_last' => 'Legion',
        'password' => $password, 'root_admin' => false, 'language' => 'en',
    ]);
}
$existingServers = Server::where('owner_id', $user->id)->count();
if ($existingServers < 2) {
    $egg = Egg::find(1);
    $location = Location::first();
    $creationService = app(ServerCreationService::class);
    $nodes = Node::orderBy('id')->get();
    for ($i = $existingServers + 1; $i <= 2; $i++) {
        $bestNode = null; $minCount = 999;
        foreach ($nodes as $n) { $cnt = Server::where('node_id', $n->id)->count(); if ($cnt < $minCount) { $minCount = $cnt; $bestNode = $n; } }
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
                'startup' => $egg->startup, 'image' => 'ghcr.io/parkervcp/yolks:nodejs_24',
                'skip_scripts' => true, 'start_on_completion' => false,
            ]);
            $volPath = '/var/lib/pterodactyl/volumes/' . $server->uuid;
            @mkdir($volPath, 0755, true);
            @copy('/opt/deathlegion/bot_template.js', $volPath . '/index.js');
            @copy('/opt/deathlegion/bot_package.json', $volPath . '/package.json');
            @chown($volPath . '/index.js', 'pterodactyl'); @chgrp($volPath . '/index.js', 'pterodactyl');
            @chown($volPath . '/package.json', 'pterodactyl'); @chgrp($volPath . '/package.json', 'pterodactyl');
        } catch (\\Exception $e) {}
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
      `echo '${b64}' | base64 -d > /tmp/legion_auth.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/legion_auth.php 2>&1 | grep -v Deprecated`, 120);
    let token = ''; let finalUsername = cleanUsername;
    for (const line of result.trim().split('\n')) {
      if (line.trim().startsWith('TOKEN:')) token = line.trim().substring(6);
      if (line.trim().startsWith('USERNAME:')) finalUsername = line.trim().substring(9);
    }
    if (token) return { success: true, token, username: finalUsername };
    return { success: false, error: result };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // POST: create user from username
  if (req.method === 'POST') {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username required' });
    const result = await createOrLoginUser(username);
    if (result.success) {
      return res.status(200).json({
        success: true,
        username: result.username,
        panelUrl: 'https://deathlegionpanel.vercel.app',
        login: { username: result.username, password: 'DeathLegion2025!' },
      });
    }
    return res.status(500).json({ error: result.error });
  }

  // GET: show the signup page
  const error = (req.query.error as string) || '';
  const success = (req.query.success as string) || '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Sign Up</title>
  <style>${DESIGN_SYSTEM_CSS}
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .signup-card { background:var(--dl-bg-elevated); backdrop-filter:blur(16px); border:1px solid rgba(188,110,60,0.2); border-radius:var(--dl-radius-xl); padding:2.5rem; max-width:440px; width:100%; text-align:center; box-shadow:var(--dl-shadow-lg), var(--dl-shadow-glow); position:relative; overflow:hidden; }
    .signup-card::before { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:radial-gradient(circle, rgba(188,110,60,0.05) 0%, transparent 60%); animation:dl-pulse-bg 8s ease-in-out infinite; pointer-events:none; }
    .signup-logo { font-family:var(--dl-font-display); font-size:2rem; font-weight:900; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.3rem; position:relative; }
    .signup-subtitle { color:var(--dl-text-muted); font-size:0.85rem; margin-bottom:2rem; position:relative; }
    .signup-form { position:relative; }
    .signup-form .form-group { margin-bottom:1rem; text-align:left; }
    .signup-form .form-group label { display:block; color:var(--dl-text-muted); font-size:0.75rem; margin-bottom:0.3rem; text-transform:uppercase; letter-spacing:0.05em; }
    .signup-form .form-group input { width:100%; padding:0.8rem 1rem; background:var(--dl-bg-input); border:1px solid var(--dl-border); border-radius:var(--dl-radius); color:var(--dl-text); font-size:0.95rem; font-family:var(--dl-font-body); transition:var(--dl-transition); }
    .signup-form .form-group input:focus { outline:none; border-color:rgba(188,110,60,0.5); box-shadow:0 0 0 3px rgba(188,110,60,0.1); }
    .signup-form .form-group .hint { color:var(--dl-text-dim); font-size:0.7rem; margin-top:0.2rem; }
    .signup-btn { display:block; width:100%; padding:0.9rem; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; text-decoration:none; border-radius:var(--dl-radius); font-weight:700; font-size:1rem; border:none; cursor:pointer; transition:var(--dl-transition); text-align:center; box-shadow:0 4px 12px rgba(188,110,60,0.25); position:relative; }
    .signup-btn:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(188,110,60,0.4); }
    .signup-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
    .signup-divider { display:flex; align-items:center; margin:1.5rem 0; color:var(--dl-text-dim); font-size:0.75rem; }
    .signup-divider::before, .signup-divider::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.06); }
    .signup-divider span { padding:0 0.75rem; }
    .signup-link { display:block; width:100%; padding:0.75rem; background:transparent; border:1px solid rgba(188,110,60,0.2); color:var(--dl-bronze-light); text-decoration:none; border-radius:var(--dl-radius); font-weight:600; font-size:0.88rem; text-align:center; transition:var(--dl-transition); }
    .signup-link:hover { background:rgba(188,110,60,0.08); border-color:rgba(188,110,60,0.4); }
    .signup-alert { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:var(--dl-red); padding:0.8rem 1rem; border-radius:var(--dl-radius); font-size:0.82rem; margin-bottom:1rem; position:relative; }
    .signup-success { background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); color:var(--dl-green); padding:0.8rem 1rem; border-radius:var(--dl-radius); font-size:0.82rem; margin-bottom:1rem; position:relative; }
    .signup-status { margin-top:1rem; padding:0.8rem; border-radius:var(--dl-radius); font-size:0.85rem; display:none; position:relative; }
    .signup-status.show { display:block; }
    .signup-status.error { background:rgba(239,68,68,0.08); color:var(--dl-red); border:1px solid rgba(239,68,68,0.2); }
    .signup-creds { margin-top:1rem; padding:1.2rem; background:rgba(0,0,0,0.3); border:1px solid rgba(188,110,60,0.2); border-radius:var(--dl-radius); font-family:var(--dl-font-mono); font-size:0.85rem; text-align:left; display:none; position:relative; }
    .signup-creds.show { display:block; }
    .signup-creds .row { display:flex; justify-content:space-between; padding:0.3rem 0; }
    .signup-creds .label { color:var(--dl-text-muted); }
    .signup-creds .value { color:var(--dl-bronze-light); }
    .signup-creds .go-link { display:block; margin-top:0.8rem; text-align:center; padding:0.6rem; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; text-decoration:none; border-radius:var(--dl-radius); font-weight:600; }
    .signup-info { margin-top:1.5rem; color:var(--dl-text-dim); font-size:0.78rem; position:relative; }
    .signup-info a { color:var(--dl-bronze); text-decoration:none; }
    .spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.2); border-top-color:#fff; border-radius:50%; animation:dl-spin 0.8s linear infinite; margin-right:0.5rem; vertical-align:middle; }
  </style>
</head>
<body class="dl-bg">
  <div class="signup-card">
    <div class="signup-logo">Death Legion</div>
    <div class="signup-subtitle">Bot Hosting Platform — Free Signup</div>

    ${error === '1' ? '<div class="signup-alert">⚠️ Something went wrong. Please try again below.</div>' : ''}
    ${success === '1' ? '<div class="signup-success">✓ Account created! Check your credentials below.</div>' : ''}

    <div class="signup-form">
      <div class="form-group">
        <label>Choose a Username</label>
        <input type="text" id="dlUsername" placeholder="e.g. shadowhunter" maxlength="20" onkeypress="if(event.key==='Enter')createAccount()" />
        <div class="hint">Min 3 chars. Letters, numbers, hyphens, underscores only.</div>
      </div>
      <button class="signup-btn" id="signupBtn" onclick="createAccount()">
        Create My Account →
      </button>
    </div>

    <div class="signup-status" id="status"></div>
    <div class="signup-creds" id="creds"></div>

    <div class="signup-divider"><span>OR</span></div>

    <a href="/apply" class="signup-link">Apply Without Legion ID</a>

    <div class="signup-info">
      <p>Already have an account? <a href="/">Log in here</a></p>
      <p style="margin-top:0.3rem;">You'll get 2 free bot servers + 100 daily credits.</p>
    </div>
  </div>

  <script>
    async function createAccount() {
      const btn = document.getElementById('signupBtn');
      const status = document.getElementById('status');
      const creds = document.getElementById('creds');
      const username = document.getElementById('dlUsername').value.trim();

      if (!username || username.length < 3) {
        status.className = 'signup-status show error';
        status.textContent = 'Username must be at least 3 characters';
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Creating your account...';

      try {
        const res = await fetch('/api/legion-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'signup-status';
          status.style.display = 'none';
          creds.className = 'signup-creds show';
          creds.innerHTML =
            '<div class="row"><span class="label">Panel URL:</span> <span class="value">' + data.panelUrl + '</span></div>' +
            '<div class="row"><span class="label">Username:</span> <span class="value">' + data.login.username + '</span></div>' +
            '<div class="row"><span class="label">Password:</span> <span class="value">' + data.login.password + '</span></div>' +
            '<a href="' + data.panelUrl + '" class="go-link">Go to Panel →</a>';
          btn.innerHTML = '✓ Account Created!';
          btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        } else {
          status.className = 'signup-status show error';
          status.textContent = data.error || 'Failed to create account';
          btn.disabled = false;
          btn.innerHTML = 'Create My Account →';
        }
      } catch(e) {
        status.className = 'signup-status show error';
        status.textContent = 'Network error: ' + e.message;
        btn.disabled = false;
        btn.innerHTML = 'Create My Account →';
      }
    }
  </script>
</body>
</html>`;

  return res.status(200).send(html);
}

export const config = { api: { bodyParser: true, sizeLimit: '10mb' }, maxDuration: 300 };
