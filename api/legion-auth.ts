import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS } from './_design';

/**
 * Legion Auth — OAuth2 Client
 * ============================
 * This page implements the OAuth2 Authorization Code flow as a CLIENT
 * connecting to the Death Legion identity provider at
 * https://deathlegion.vercel.app
 *
 * Flow:
 * 1. User clicks "Connect with Death Legion"
 * 2. Redirected to deathlegion.vercel.app/api/oauth/authorize
 * 3. User approves on Death Legion
 * 4. Redirected back here with ?code=...
 * 5. We exchange the code for tokens (server-side, using client_secret)
 * 6. We call userinfo to get the user's Death Legion profile
 * 7. We create/login a panel account matching that profile
 * 8. Show the user their panel credentials
 *
 * The client_id and client_secret are registered on deathlegion.vercel.app.
 */

// === OAuth Config ===
const DL_OAUTH_BASE = 'https://deathlegion.vercel.app';
const DL_CLIENT_ID = process.env.DL_CLIENT_ID || '31e2c359ab06df6bc57aa3f27bdeca33';
const DL_CLIENT_SECRET = process.env.DL_CLIENT_SECRET || 'efc80e473be78922a74ac7786765212859d0048018bec73c7c2c755be1ba2ecd';
const DL_REDIRECT_URI = 'https://deathlegionpanel.vercel.app/oauth/callback';
const DL_SCOPES = 'profile email';

// === Panel config ===
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

/**
 * Create or login a panel user based on their Death Legion profile.
 * Also provisions 2 bot servers if they don't have any.
 */
async function createOrLoginUser(username: string, email?: string): Promise<{ success: boolean; token?: string; username?: string; error?: string }> {
  try {
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanUsername.length < 3) return { success: false, error: 'Username must be at least 3 characters' };
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
if ($existingServers < 3) {
    $egg = Egg::find(1);
    $location = Location::first();
    $creationService = app(ServerCreationService::class);
    $nodes = Node::orderBy('id')->get();
    for ($i = $existingServers + 1; $i <= 3; $i++) {
        $currentCount = Server::where('owner_id', $user->id)->count();
        if ($currentCount >= 3) break;
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

  const code = (req.query.code as string) || '';
  const state = (req.query.state as string) || '';
  const oauthError = (req.query.error as string) || '';
  const oauthErrorDesc = (req.query.error_description as string) || '';

  // === OAuth callback: exchange code for tokens + create user ===
  if (code) {
    return handleOAuthCallback(req, res, code, state);
  }

  // === Error callback (user denied) ===
  if (oauthError) {
    return renderPage(res, { error: `${oauthError}: ${oauthErrorDesc}` });
  }

  // === GET: show the "Connect with Death Legion" page ===
  return renderPage(res, {});
}

// === Handle the OAuth callback ===
async function handleOAuthCallback(req: VercelRequest, res: VercelResponse, code: string, state: string) {
  try {
    // Step 1: Exchange code for tokens
    const tokenResp = await fetch(`${DL_OAUTH_BASE}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: DL_CLIENT_ID,
        client_secret: DL_CLIENT_SECRET,
        redirect_uri: DL_REDIRECT_URI,
      }),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.json().catch(() => ({}));
      return renderPage(res, { error: `Token exchange failed: ${err.error_description || err.error || tokenResp.statusText}` });
    }

    const tokens = await tokenResp.json();

    // Step 2: Fetch user profile from userinfo
    const userResp = await fetch(`${DL_OAUTH_BASE}/api/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (!userResp.ok) {
      return renderPage(res, { error: 'Failed to fetch user profile from Death Legion' });
    }

    const userInfo = await userResp.json();

    // Step 3: Create or login panel user
    if (!userInfo.username) {
      return renderPage(res, { error: 'Death Legion profile missing username' });
    }

    const result = await createOrLoginUser(userInfo.username, userInfo.email);
    if (!result.success) {
      return renderPage(res, { error: result.error || 'Failed to create panel account' });
    }

    // Step 4: Show success page with credentials
    return renderPage(res, {
      success: true,
      username: result.username,
      memberNumber: userInfo.memberNumber,
      email: userInfo.email,
      panelUrl: 'https://deathlegionpanel.vercel.app',
    });

  } catch (e: any) {
    return renderPage(res, { error: `OAuth callback error: ${e?.message || e}` });
  }
}

// === Render the page ===
function renderPage(res: VercelResponse, data: {
  error?: string;
  success?: boolean;
  username?: string;
  memberNumber?: string;
  email?: string;
  panelUrl?: string;
}) {
  // Generate state for CSRF protection
  const oauthState = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const oauthUrl = `${DL_OAUTH_BASE}/api/oauth/authorize?response_type=code&client_id=${DL_CLIENT_ID}&redirect_uri=${encodeURIComponent(DL_REDIRECT_URI)}&scope=${encodeURIComponent(DL_SCOPES)}&state=${oauthState}`;

  const successHtml = data.success ? `
    <div class="signup-success">
      <div style="font-size:2.5rem;margin-bottom:0.5rem;">✓</div>
      <h2 style="font-family:var(--dl-font-display);color:var(--dl-green);font-size:1.3rem;margin-bottom:0.3rem;">Connected!</h2>
      <p>Welcome, <strong>${data.username}</strong>! Your panel account is ready.</p>
    </div>
    <div class="signup-creds show">
      <div class="row"><span class="label">Panel URL:</span> <span class="value">${data.panelUrl}</span></div>
      <div class="row"><span class="label">Username:</span> <span class="value">${data.username}</span></div>
      <div class="row"><span class="label">Password:</span> <span class="value">DeathLegion2025!</span></div>
      ${data.memberNumber ? `<div class="row"><span class="label">DL Member #:</span> <span class="value">${data.memberNumber}</span></div>` : ''}
      ${data.email ? `<div class="row"><span class="label">Email:</span> <span class="value">${data.email}</span></div>` : ''}
      <a href="${data.panelUrl}" class="go-link">Go to Panel →</a>
    </div>
  ` : '';

  const errorHtml = data.error ? `<div class="signup-alert">⚠️ ${data.error}</div>` : '';

  const connectBtnHtml = data.success ? '' : `
    <a href="${oauthUrl}" class="signup-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;margin-right:0.5rem;">
        <path d="M12 1 22 6v6c0 6-4.2 9.8-10 11C6.2 21.8 2 18 2 12V6l10-5z" stroke="#fff" stroke-width="1.4"/>
      </svg>
      Connect with Death Legion
    </a>
    <div class="signup-info">
      <p>You'll be redirected to Death Legion to approve, then sent back here with your account ready.</p>
      <p style="margin-top:0.3rem;">Don't have a Death Legion ID? <a href="${DL_OAUTH_BASE}" target="_blank" rel="noopener">Register here</a></p>
    </div>
    <div class="signup-divider"><span>OR</span></div>
    <a href="/apply" class="signup-link">Apply Without Legion ID</a>
  `;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Connect</title>
  <style>${DESIGN_SYSTEM_CSS}
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .signup-card { background:var(--dl-bg-elevated); backdrop-filter:blur(16px); border:1px solid rgba(188,110,60,0.2); border-radius:var(--dl-radius-xl); padding:2.5rem; max-width:440px; width:100%; text-align:center; box-shadow:var(--dl-shadow-lg), var(--dl-shadow-glow); position:relative; overflow:hidden; }
    .signup-card::before { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:radial-gradient(circle, rgba(188,110,60,0.05) 0%, transparent 60%); animation:dl-pulse-bg 8s ease-in-out infinite; pointer-events:none; }
    .signup-logo { font-family:var(--dl-font-display); font-size:2rem; font-weight:900; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.3rem; position:relative; }
    .signup-subtitle { color:var(--dl-text-muted); font-size:0.85rem; margin-bottom:2rem; position:relative; }
    .signup-btn { display:flex; align-items:center; justify-content:center; width:100%; padding:0.9rem; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; text-decoration:none; border-radius:var(--dl-radius); font-weight:700; font-size:1rem; border:none; cursor:pointer; transition:var(--dl-transition); box-shadow:0 4px 12px rgba(188,110,60,0.25); position:relative; }
    .signup-btn:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(188,110,60,0.4); }
    .signup-divider { display:flex; align-items:center; margin:1.5rem 0; color:var(--dl-text-dim); font-size:0.75rem; position:relative; }
    .signup-divider::before, .signup-divider::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.06); }
    .signup-divider span { padding:0 0.75rem; }
    .signup-link { display:block; width:100%; padding:0.75rem; background:transparent; border:1px solid rgba(188,110,60,0.2); color:var(--dl-bronze-light); text-decoration:none; border-radius:var(--dl-radius); font-weight:600; font-size:0.88rem; text-align:center; transition:var(--dl-transition); position:relative; }
    .signup-link:hover { background:rgba(188,110,60,0.08); border-color:rgba(188,110,60,0.4); }
    .signup-alert { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:var(--dl-red); padding:0.8rem 1rem; border-radius:var(--dl-radius); font-size:0.82rem; margin-bottom:1rem; position:relative; text-align:left; }
    .signup-success { background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); border-radius:var(--dl-radius); padding:1.5rem; margin-bottom:1rem; position:relative; }
    .signup-success p { color:var(--dl-text-muted); font-size:0.85rem; }
    .signup-creds { margin-top:1rem; padding:1.2rem; background:rgba(0,0,0,0.3); border:1px solid rgba(188,110,60,0.2); border-radius:var(--dl-radius); font-family:var(--dl-font-mono); font-size:0.85rem; text-align:left; position:relative; }
    .signup-creds .row { display:flex; justify-content:space-between; padding:0.3rem 0; }
    .signup-creds .label { color:var(--dl-text-muted); }
    .signup-creds .value { color:var(--dl-bronze-light); }
    .signup-creds .go-link { display:block; margin-top:0.8rem; text-align:center; padding:0.6rem; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; text-decoration:none; border-radius:var(--dl-radius); font-weight:600; font-family:var(--dl-font-body); }
    .signup-info { margin-top:1.5rem; color:var(--dl-text-dim); font-size:0.78rem; position:relative; }
    .signup-info a { color:var(--dl-bronze); text-decoration:none; }
    .spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.2); border-top-color:#fff; border-radius:50%; animation:dl-spin 0.8s linear infinite; margin-right:0.5rem; vertical-align:middle; }
  </style>
</head>
<body class="dl-bg">
  <div class="signup-card">
    <div class="signup-logo">Death Legion</div>
    <div class="signup-subtitle">Bot Hosting Platform</div>
    ${errorHtml}
    ${successHtml}
    ${connectBtnHtml}
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(html);
}

export const config = { api: { bodyParser: true, sizeLimit: '10mb' }, maxDuration: 300 };
