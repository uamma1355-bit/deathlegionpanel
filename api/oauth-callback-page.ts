import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from './_design';

/**
 * OAuth Callback Handler
 * URL: /oauth/callback
 *
 * This is the registered redirect URI for the Death Legion Panel OAuth app
 * on deathlegion.vercel.app. When a user clicks "Connect with Death Legion"
 * on /legion-auth, they approve on deathlegion.vercel.app, and Death Legion
 * redirects them here with ?code=AUTH_CODE&state=...
 *
 * This handler:
 * 1. Receives the code (or error)
 * 2. Exchanges the code for tokens (server-side, using client_secret)
 * 3. Calls userinfo to get the user's Death Legion profile
 * 4. Creates/logs in a panel account matching that profile
 * 5. Shows the user their panel credentials
 *
 * If there's no code (direct visit), shows an interactive token exchange form
 * for manual testing.
 */

// OAuth config — must match what's registered on deathlegion.vercel.app
const DL_OAUTH_BASE = 'https://deathlegion.vercel.app';
const DL_CLIENT_ID = process.env.DL_CLIENT_ID || '31e2c359ab06df6bc57aa3f27bdeca33';
const DL_CLIENT_SECRET = process.env.DL_CLIENT_SECRET || 'efc80e473be78922a74ac7786765212859d0048018bec73c7c2c755be1ba2ecd';
const DL_REDIRECT_URI = 'https://deathlegionpanel.vercel.app/oauth/callback';

// Panel config
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

async function createOrLoginUser(username: string, email?: string): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanUsername.length < 3) return { success: false, error: 'Username too short' };
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
echo "USERNAME:" . $user->username . "\\n";
echo "DONE\\n";
`;
    const b64 = Buffer.from(phpScript).toString('base64');
    const result = await executeOnSandbox(
      `echo '${b64}' | base64 -d > /tmp/legion_auth.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/legion_auth.php 2>&1 | grep -v Deprecated`, 120);
    let finalUsername = cleanUsername;
    for (const line of result.trim().split('\n')) {
      if (line.trim().startsWith('USERNAME:')) finalUsername = line.trim().substring(9);
    }
    return { success: true, username: finalUsername };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const code = (req.query.code as string) || '';
  const state = (req.query.state as string) || '';
  const error = (req.query.error as string) || '';
  const errorDescription = (req.query.error_description as string) || '';

  // === OAuth error (user denied) ===
  if (error) {
    return renderPage(res, { error: `${error}: ${errorDescription}` });
  }

  // === OAuth callback with code — do the full exchange ===
  if (code) {
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

      // Step 2: Fetch user profile
      const userResp = await fetch(`${DL_OAUTH_BASE}/api/oauth/userinfo`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });

      if (!userResp.ok) {
        return renderPage(res, { error: 'Failed to fetch user profile from Death Legion' });
      }

      const userInfo = await userResp.json();

      if (!userInfo.username) {
        return renderPage(res, { error: 'Death Legion profile missing username' });
      }

      // Step 3: Create/login panel user
      const result = await createOrLoginUser(userInfo.username, userInfo.email);
      if (!result.success) {
        return renderPage(res, { error: result.error || 'Failed to create panel account' });
      }

      // Step 4: Auto-login the user (set session cookies via the panel's login API)
      const panelUsername = result.username;
      const panelPassword = 'DeathLegion2025!';
      let loginOk = false;
      try {
        // Get CSRF cookie
        const csrfResp = await fetch('https://deathlegionpanel.vercel.app/sanctum/csrf-cookie');
        const setCookies = csrfResp.headers.getSetCookie?.() || [];
        let xsrfToken = '';
        let sessionCookie = '';
        for (const c of setCookies) {
          const m = c.match(/XSRF-TOKEN=([^;]+)/);
          if (m) xsrfToken = decodeURIComponent(m[1]);
          const s = c.match(/pterodactyl_session=([^;]+)/);
          if (s) sessionCookie = s[1];
        }

        // Login
        const loginResp = await fetch('https://deathlegionpanel.vercel.app/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-XSRF-TOKEN': xsrfToken,
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': `XSRF-TOKEN=${encodeURIComponent(xsrfToken)}; pterodactyl_session=${sessionCookie}`,
          },
          body: JSON.stringify({ user: panelUsername, password: panelPassword }),
        });

        if (loginResp.ok) {
          const loginData = await loginResp.json();
          if (loginData?.data?.complete) {
            loginOk = true;
            // Forward the session cookies to the browser
            const respCookies = loginResp.headers.getSetCookie?.() || [];
            for (const c of respCookies) {
              const cookiePart = c.split(';')[0];
              res.setHeader('Set-Cookie', c.split(';').slice(0).join(';'));
            }
          }
        }
      } catch (e) {
        // Login failed — still show credentials so user can log in manually
      }

      // Step 5: Show success (with auto-redirect if login succeeded)
      return renderPage(res, {
        success: true,
        username: result.username,
        memberNumber: userInfo.memberNumber,
        email: userInfo.email,
        tokens,
        autoLogin: loginOk,
      });

    } catch (e: any) {
      return renderPage(res, { error: `OAuth callback error: ${e?.message || e}` });
    }
  }

  // === No code — show interactive form for manual testing ===
  return renderPage(res, { manual: true });
}

function renderPage(res: VercelResponse, data: {
  error?: string;
  success?: boolean;
  username?: string;
  memberNumber?: string;
  email?: string;
  tokens?: any;
  manual?: boolean;
  autoLogin?: boolean;
}) {
  const errorHtml = data.error ? `
    <div class="step-card" style="border-color:rgba(239,68,68,0.3);">
      <div class="step-header">
        <div class="step-num" style="background:linear-gradient(135deg, #ef4444, #f87171);">!</div>
        <div class="step-title" style="color:var(--dl-red);">Error</div>
      </div>
      <p style="color:var(--dl-text-muted);font-size:0.85rem;">${data.error}</p>
      <a href="/legion-auth" class="dl-btn dl-btn-primary" style="margin-top:1rem;">← Back to Connect</a>
    </div>
  ` : '';

  const successHtml = data.success ? `
    <div class="step-card dl-fade-in active" style="border-color:rgba(34,197,94,0.3);box-shadow:0 0 30px rgba(34,197,94,0.1);">
      <div class="step-header">
        <div class="step-num" style="background:linear-gradient(135deg, #22c55e, #16a34a);">✓</div>
        <div class="step-title" style="color:var(--dl-green);">Connected Successfully</div>
        <div class="step-status"><span class="dl-pill dl-pill-green">✓ Done</span></div>
      </div>
      <p style="color:var(--dl-text);font-size:1rem;margin-bottom:1rem;">Welcome, <strong>${data.username}</strong>! Your panel account is ready.</p>
      ${data.autoLogin ? `
        <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:var(--dl-radius);padding:1rem;margin-bottom:1rem;text-align:center;">
          <p style="color:var(--dl-green);font-size:0.9rem;margin-bottom:0.5rem;">✓ You're logged in! Redirecting to your panel...</p>
          <div class="dl-spinner" style="margin:0 auto;"></div>
          <p style="color:var(--dl-text-dim);font-size:0.75rem;margin-top:0.5rem;">Auto-redirecting in 2 seconds</p>
        </div>
        <a href="/" class="go-link">Go to Panel Now →</a>
        <script>setTimeout(function(){ window.location.href = '/'; }, 2000);</script>
      ` : `
        <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:var(--dl-radius);padding:0.8rem;margin-bottom:1rem;text-align:center;">
          <p style="color:var(--dl-yellow);font-size:0.82rem;">⚠️ Auto-login failed. Click below to log in manually.</p>
        </div>
        <a href="/" class="go-link">Click Here to Log In →</a>
      `}
      <details style="margin-top:1rem;">
        <summary style="color:var(--dl-text-dim);font-size:0.75rem;cursor:pointer;">Show account credentials</summary>
        <div class="signup-creds" style="margin-top:0.5rem;">
          <div class="row"><span class="label">Panel URL:</span> <span class="value">https://deathlegionpanel.vercel.app</span></div>
          <div class="row"><span class="label">Username:</span> <span class="value">${data.username}</span></div>
          <div class="row"><span class="label">Password:</span> <span class="value">DeathLegion2025!</span></div>
          ${data.memberNumber ? `<div class="row"><span class="label">DL Member #:</span> <span class="value">${data.memberNumber}</span></div>` : ''}
          ${data.email ? `<div class="row"><span class="label">Email:</span> <span class="value">${data.email}</span></div>` : ''}
        </div>
      </details>
    </div>
  ` : '';

  const manualHtml = data.manual ? `
    <div class="dl-hero">
      <h1>OAuth Callback</h1>
      <p>This is the registered redirect URI for Death Legion OAuth. Visit <a href="/legion-auth" style="color:var(--dl-bronze-light);">/legion-auth</a> to start the OAuth flow.</p>
    </div>
    <div class="step-card">
      <div class="step-header">
        <div class="step-num">?</div>
        <div class="step-title">No Authorization Code</div>
      </div>
      <p style="color:var(--dl-text-muted);font-size:0.85rem;">This page handles the OAuth callback from deathlegion.vercel.app. To test:</p>
      <ol style="color:var(--dl-text-muted);font-size:0.82rem;line-height:1.8;margin-top:0.5rem;padding-left:1.5rem;">
        <li>Go to <a href="/legion-auth" style="color:var(--dl-bronze-light);">/legion-auth</a></li>
        <li>Click "Connect with Death Legion"</li>
        <li>Approve on deathlegion.vercel.app</li>
        <li>You'll be redirected back here automatically</li>
      </ol>
      <a href="/legion-auth" class="dl-btn dl-btn-primary" style="margin-top:1rem;">← Go to Connect Page</a>
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — OAuth Callback</title>
  <style>${DESIGN_SYSTEM_CSS}
    .step-card { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.5rem; margin-bottom:1rem; }
    .step-card.active { border-color:rgba(188,110,60,0.3); }
    .step-header { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.8rem; }
    .step-num { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.82rem; flex-shrink:0; }
    .step-title { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:0.95rem; font-weight:700; letter-spacing:0.03em; text-transform:uppercase; }
    .step-status { margin-left:auto; }
    .signup-creds { margin-top:1rem; padding:1.2rem; background:rgba(0,0,0,0.3); border:1px solid rgba(188,110,60,0.2); border-radius:var(--dl-radius); font-family:var(--dl-font-mono); font-size:0.85rem; text-align:left; }
    .signup-creds .row { display:flex; justify-content:space-between; padding:0.3rem 0; }
    .signup-creds .label { color:var(--dl-text-muted); }
    .signup-creds .value { color:var(--dl-bronze-light); word-break:break-all; }
    .signup-creds .go-link { display:block; margin-top:0.8rem; text-align:center; padding:0.6rem; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; text-decoration:none; border-radius:var(--dl-radius); font-weight:600; font-family:var(--dl-font-body); }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/oauth')}
  <div class="dl-container">
    ${errorHtml}
    ${successHtml}
    ${manualHtml}
    <div class="dl-footer">
      <p><a href="/legion-auth">← Back to Connect</a> · <a href="/">Panel</a></p>
    </div>
  </div>
</body>
</html>`;

  return res.status(200).send(html);
}

export const config = { api: { bodyParser: true, sizeLimit: '10mb' }, maxDuration: 300 };
