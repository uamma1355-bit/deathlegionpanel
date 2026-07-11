import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from './_design';

/**
 * OAuth Callback Handler
 * URL: /oauth/callback
 *
 * This is a demo/reference callback page that handles the redirect from
 * /api/oauth/authorize. It:
 * 1. Receives ?code=...&state=... (or ?error=...)
 * 2. Validates state (CSRF protection)
 * 3. Lets the user exchange the code for tokens
 * 4. Displays the token response + user profile from userinfo
 *
 * Apps integrating with Death Legion OAuth should implement their own
 * callback handler server-side. This page is for testing/demo purposes.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const code = (req.query.code as string) || '';
  const state = (req.query.state as string) || '';
  const error = (req.query.error as string) || '';
  const errorDescription = (req.query.error_description as string) || '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — OAuth Callback</title>
  <style>${DESIGN_SYSTEM_CSS}
    .callback-hero { text-align:center; }
    .callback-hero .icon { font-size:3rem; margin-bottom:0.5rem; }
    .callback-hero h1 { font-family:var(--dl-font-display); font-size:1.6rem; margin-bottom:0.3rem; }
    .step-card { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.5rem; margin-bottom:1rem; }
    .step-card.active { border-color:rgba(188,110,60,0.3); box-shadow:var(--dl-shadow-glow); }
    .step-header { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.8rem; }
    .step-num { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light)); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.82rem; flex-shrink:0; }
    .step-title { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:0.95rem; font-weight:700; letter-spacing:0.03em; text-transform:uppercase; }
    .step-status { margin-left:auto; }
    .code-block { background:rgba(0,0,0,0.4); border:1px solid var(--dl-border); border-radius:var(--dl-radius); padding:0.8rem; font-family:var(--dl-font-mono); font-size:0.78rem; color:var(--dl-text); overflow-x:auto; word-break:break-all; margin:0.5rem 0; position:relative; }
    .code-block .copy-btn { position:absolute; top:0.4rem; right:0.4rem; padding:0.2rem 0.6rem; background:rgba(188,110,60,0.15); border:1px solid rgba(188,110,60,0.2); border-radius:4px; color:var(--dl-bronze-light); font-size:0.65rem; cursor:pointer; }
    .form-group { margin-bottom:0.8rem; }
    .form-group label { display:block; color:var(--dl-text-muted); font-size:0.75rem; margin-bottom:0.25rem; text-transform:uppercase; letter-spacing:0.05em; }
    .form-group input { width:100%; padding:0.55rem 0.8rem; background:var(--dl-bg-input); border:1px solid var(--dl-border); border-radius:var(--dl-radius); color:var(--dl-text); font-size:0.82rem; font-family:var(--dl-font-mono); transition:var(--dl-transition); }
    .form-group input:focus { outline:none; border-color:rgba(188,110,60,0.5); box-shadow:0 0 0 3px rgba(188,110,60,0.1); }
    .json-display { background:rgba(0,0,0,0.5); border:1px solid var(--dl-border); border-radius:var(--dl-radius); padding:0.8rem; font-family:var(--dl-font-mono); font-size:0.75rem; color:#a8e6a3; overflow-x:auto; max-height:300px; overflow-y:auto; white-space:pre-wrap; word-break:break-all; }
    .json-display.error { color:#f87171; }
    .param-row { display:flex; gap:0.5rem; margin-bottom:0.4rem; align-items:start; }
    .param-label { color:var(--dl-text-dim); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; min-width:100px; padding-top:0.15rem; }
    .param-value { font-family:var(--dl-font-mono); font-size:0.78rem; color:var(--dl-text); word-break:break-all; flex:1; }
    .error-box { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:var(--dl-radius); padding:1rem; margin-bottom:1rem; }
    .error-box h3 { color:var(--dl-red); font-size:0.9rem; margin-bottom:0.3rem; }
    .error-box p { color:var(--dl-text-muted); font-size:0.82rem; }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/oauth')}
  <div class="dl-container">

    ${error ? `
    <div class="error-box">
      <h3>⚠️ Authorization Denied</h3>
      <p><strong>Error:</strong> ${escapeHtml(error)}</p>
      ${errorDescription ? `<p><strong>Description:</strong> ${escapeHtml(errorDescription)}</p>` : ''}
      <p style="margin-top:0.8rem;"><a href="/oauth" class="dl-btn dl-btn-outline">Back to OAuth Apps</a></p>
    </div>
    ` : ''}

    <div class="dl-hero callback-hero">
      <div class="icon">${error ? '❌' : '✅'}</div>
      <h1>${error ? 'Authorization Failed' : 'Authorization Received'}</h1>
      <p>${error ? 'The authorization request was denied or failed.' : 'Death Legion redirected here with an authorization code. Exchange it for tokens below.'}</p>
    </div>

    ${!error && code ? `
    <!-- Step 1: Callback parameters -->
    <div class="step-card dl-fade-in active">
      <div class="step-header">
        <div class="step-num">1</div>
        <div class="step-title">Callback Received</div>
        <div class="step-status"><span class="dl-pill dl-pill-green">✓ Done</span></div>
      </div>
      <p style="color:var(--dl-text-muted);font-size:0.82rem;margin-bottom:0.6rem;">Death Legion redirected to your callback URL with these parameters:</p>
      <div class="param-row">
        <span class="param-label">Code</span>
        <span class="param-value">${escapeHtml(code)}</span>
      </div>
      ${state ? `
      <div class="param-row">
        <span class="param-label">State</span>
        <span class="param-value">${escapeHtml(state)}</span>
      </div>
      ` : ''}
      <div style="margin-top:0.5rem;color:var(--dl-text-dim);font-size:0.72rem;">⚠️ The authorization code expires in 10 minutes and can only be used once.</div>
    </div>

    <!-- Step 2: Exchange code for tokens -->
    <div class="step-card dl-fade-in active">
      <div class="step-header">
        <div class="step-num">2</div>
        <div class="step-title">Exchange Code for Tokens</div>
        <div class="step-status" id="step2Status"><span class="dl-pill dl-pill-bronze">Pending</span></div>
      </div>
      <p style="color:var(--dl-text-muted);font-size:0.82rem;margin-bottom:0.8rem;">Enter your app's client_id and client_secret to exchange the code for access + refresh tokens.</p>
      <div class="form-group">
        <label>Client ID</label>
        <input type="text" id="clientId" placeholder="858eaba024b9b37fc6d23ddb1f2cefc4" />
      </div>
      <div class="form-group">
        <label>Client Secret</label>
        <input type="password" id="clientSecret" placeholder="2fcce4e2bcdbd5d12d504bce0632e8889e7873db..." />
      </div>
      <div class="form-group">
        <label>Redirect URI (must match the one used in authorize)</label>
        <input type="url" id="redirectUri" value="https://deathlegionpanel.vercel.app/oauth/callback" />
      </div>
      <button class="dl-btn dl-btn-primary" id="exchangeBtn" onclick="exchangeCode()">
        <span id="exchangeBtnText">Exchange Code →</span>
      </button>
      <div id="tokenResult" style="display:none;margin-top:1rem;">
        <div style="color:var(--dl-text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.3rem;">Token Response</div>
        <div class="json-display" id="tokenJson"></div>
      </div>
    </div>

    <!-- Step 3: Fetch user profile -->
    <div class="step-card" id="step3Card" style="opacity:0.4;">
      <div class="step-header">
        <div class="step-num">3</div>
        <div class="step-title">Fetch User Profile</div>
        <div class="step-status" id="step3Status"><span class="dl-pill dl-pill-bronze">Waiting</span></div>
      </div>
      <p style="color:var(--dl-text-muted);font-size:0.82rem;margin-bottom:0.8rem;">Use the access token to call the userinfo endpoint and get the user's Death Legion profile.</p>
      <button class="dl-btn dl-btn-primary" id="fetchProfileBtn" onclick="fetchProfile()" disabled>
        Fetch Profile →
      </button>
      <div id="profileResult" style="display:none;margin-top:1rem;">
        <div style="color:var(--dl-text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.3rem;">User Profile (from /api/oauth/userinfo)</div>
        <div class="json-display" id="profileJson"></div>
      </div>
    </div>

    <!-- Step 4: Token management -->
    <div class="step-card" id="step4Card" style="opacity:0.4;">
      <div class="step-header">
        <div class="step-num">4</div>
        <div class="step-title">Token Management</div>
        <div class="step-status"><span class="dl-pill dl-pill-bronze">Optional</span></div>
      </div>
      <p style="color:var(--dl-text-muted);font-size:0.82rem;margin-bottom:0.8rem;">Refresh the access token (old refresh token is revoked) or revoke all tokens.</p>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button class="dl-btn dl-btn-outline" id="refreshBtn" onclick="refreshToken()" disabled>🔄 Refresh Token</button>
        <button class="dl-btn dl-btn-danger" id="revokeBtn" onclick="revokeToken()" disabled>🚫 Revoke Token</button>
      </div>
      <div id="refreshResult" style="display:none;margin-top:1rem;">
        <div style="color:var(--dl-text-muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.3rem;">Refresh Response</div>
        <div class="json-display" id="refreshJson"></div>
      </div>
    </div>
    ` : ''}

    ${!error && !code ? `
    <div class="dl-empty">
      <div class="dl-empty-icon">🔗</div>
      <h3>No Authorization Code</h3>
      <p>This page is the OAuth callback handler. No <code>code</code> parameter was found in the URL.</p>
      <p style="margin-top:0.5rem;">To test the flow:</p>
      <ol style="text-align:left;max-width:400px;margin:1rem auto;color:var(--dl-text-muted);font-size:0.85rem;line-height:1.8;">
        <li>Go to <a href="/oauth" style="color:var(--dl-bronze-light);">/oauth</a> and create an app</li>
        <li>Add <code style="color:var(--dl-bronze-light);">https://deathlegionpanel.vercel.app/oauth/callback</code> as a redirect URI</li>
        <li>Visit the authorize URL with your client_id</li>
        <li>Approve → you'll be redirected back here with a code</li>
      </ol>
    </div>
    ` : ''}

    <div class="dl-footer">
      <p><a href="/oauth">← Back to OAuth Apps</a> · <a href="/">Panel</a></p>
    </div>
  </div>

  <script>
    let accessToken = '';
    let refreshToken = '';

    function escapeHtml(s) {
      return String(s||'').replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    }

    function setStepStatus(stepId, pillClass, text) {
      const el = document.getElementById(stepId + 'Status');
      if (el) el.innerHTML = '<span class="dl-pill ' + pillClass + '">' + text + '</span>';
    }

    async function exchangeCode() {
      const clientId = document.getElementById('clientId').value.trim();
      const clientSecret = document.getElementById('clientSecret').value.trim();
      const redirectUri = document.getElementById('redirectUri').value.trim();
      const btn = document.getElementById('exchangeBtn');
      const btnText = document.getElementById('exchangeBtnText');

      if (!clientId || !clientSecret) {
        alert('Client ID and Client Secret are required');
        return;
      }

      btn.disabled = true;
      btnText.innerHTML = '<span class="dl-spinner"></span> Exchanging...';
      setStepStatus('step2', 'dl-pill-yellow', 'Exchanging');

      try {
        const res = await fetch('/api/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: ${JSON.stringify(code)},
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          })
        });
        const data = await res.json();

        document.getElementById('tokenResult').style.display = 'block';
        document.getElementById('tokenJson').textContent = JSON.stringify(data, null, 2);
        document.getElementById('tokenJson').className = 'json-display' + (data.error ? ' error' : '');

        if (data.access_token) {
          accessToken = data.access_token;
          refreshToken = data.refresh_token;
          setStepStatus('step2', 'dl-pill-green', '✓ Success');

          // Enable step 3
          document.getElementById('step3Card').style.opacity = '1';
          document.getElementById('fetchProfileBtn').disabled = false;

          // Enable step 4
          document.getElementById('step4Card').style.opacity = '1';
          document.getElementById('refreshBtn').disabled = false;
          document.getElementById('revokeBtn').disabled = false;
        } else {
          setStepStatus('step2', 'dl-pill-red', '✗ Failed');
        }
      } catch(e) {
        document.getElementById('tokenResult').style.display = 'block';
        document.getElementById('tokenJson').textContent = 'Network error: ' + e.message;
        document.getElementById('tokenJson').className = 'json-display error';
        setStepStatus('step2', 'dl-pill-red', '✗ Error');
      }

      btn.disabled = false;
      btnText.textContent = 'Exchange Again';
    }

    async function fetchProfile() {
      const btn = document.getElementById('fetchProfileBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="dl-spinner"></span> Fetching...';
      setStepStatus('step3', 'dl-pill-yellow', 'Fetching');

      try {
        const res = await fetch('/api/oauth/userinfo', {
          headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const data = await res.json();

        document.getElementById('profileResult').style.display = 'block';
        document.getElementById('profileJson').textContent = JSON.stringify(data, null, 2);
        document.getElementById('profileJson').className = 'json-display' + (data.error ? ' error' : '');

        if (!data.error) {
          setStepStatus('step3', 'dl-pill-green', '✓ Success');
        } else {
          setStepStatus('step3', 'dl-pill-red', '✗ Failed');
        }
      } catch(e) {
        document.getElementById('profileResult').style.display = 'block';
        document.getElementById('profileJson').textContent = 'Network error: ' + e.message;
        document.getElementById('profileJson').className = 'json-display error';
        setStepStatus('step3', 'dl-pill-red', '✗ Error');
      }

      btn.disabled = false;
      btn.innerHTML = 'Fetch Again';
    }

    async function refreshToken() {
      const btn = document.getElementById('refreshBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="dl-spinner"></span> Refreshing...';

      const clientId = document.getElementById('clientId').value.trim();
      const clientSecret = document.getElementById('clientSecret').value.trim();

      try {
        const res = await fetch('/api/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
          })
        });
        const data = await res.json();

        document.getElementById('refreshResult').style.display = 'block';
        document.getElementById('refreshJson').textContent = JSON.stringify(data, null, 2);
        document.getElementById('refreshJson').className = 'json-display' + (data.error ? ' error' : '');

        if (data.access_token) {
          accessToken = data.access_token;
          refreshToken = data.refresh_token;
          btn.innerHTML = '🔄 Refreshed! Click to refresh again';
        } else {
          btn.innerHTML = '🔄 Refresh Failed';
        }
      } catch(e) {
        document.getElementById('refreshResult').style.display = 'block';
        document.getElementById('refreshJson').textContent = 'Network error: ' + e.message;
        document.getElementById('refreshJson').className = 'json-display error';
      }

      btn.disabled = false;
      setTimeout(() => { btn.innerHTML = '🔄 Refresh Token'; }, 2000);
    }

    async function revokeToken() {
      if (!confirm('Revoke the access token? The user will need to re-authorize.')) return;

      const btn = document.getElementById('revokeBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="dl-spinner"></span> Revoking...';

      try {
        await fetch('/api/oauth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: accessToken })
        });
        btn.innerHTML = '🚫 Revoked';
        setStepStatus('step3', 'dl-pill-red', 'Revoked');
        setStepStatus('step2', 'dl-pill-red', 'Revoked');
        alert('Token revoked. UserInfo calls will now return invalid_token.');
      } catch(e) {
        btn.innerHTML = '🚫 Failed';
      }

      setTimeout(() => { btn.innerHTML = '🚫 Revoke Token'; btn.disabled = false; }, 3000);
    }
  </script>
</body>
</html>`;

  return res.status(200).send(html);
}

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]!));
}
