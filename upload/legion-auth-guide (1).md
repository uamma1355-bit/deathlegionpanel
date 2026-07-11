# Death Legion OAuth2 — Complete Integration Guide

Connect any app to Death Legion's identity system. Users click "Connect with Death Legion", approve in a popup, and your app gets a Bearer token to access their profile.

**Base URL:** `https://deathlegion.vercel.app`
**Spec:** OAuth 2.0 Authorization Code grant with refresh tokens
**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/oauth/authorize` | GET | Show consent screen, issue authorization code |
| `/api/oauth/authorize` | POST | Submit user's approve/deny decision |
| `/api/oauth/token` | POST | Exchange code for access token, or refresh token |
| `/api/oauth/userinfo` | GET | Get user profile from access token |
| `/api/oauth/introspect` | POST | Validate a token (RFC 7662) |
| `/api/oauth/revoke` | POST | Revoke a token (RFC 7009) |

---

## Quick Start (5 minutes)

### 1. Register your app

Log in as admin → **Dashboard → OAuth Apps → New app**:

| Field | Example |
|-------|---------|
| App name | `My Legion App` |
| Description | `What your app does` |
| Homepage URL | `https://myapp.com` |
| Redirect URIs | `https://myapp.com/auth/callback` (one per line) |

You'll get:
```
Client ID:     858eaba024b9b37fc6d23ddb1f2cefc4
Client Secret: 2fcce4e2bcdbd5d12d504bce0632e8889e7873dbbc94ded3b05911ce252a0bf5
```

Store these server-side. Never expose the client secret in frontend code.

### 2. Add "Connect with Death Legion" button

```html
<a href="https://deathlegion.vercel.app/api/oauth/authorize?
    response_type=code&
    client_id=YOUR_CLIENT_ID&
    redirect_uri=https://myapp.com/auth/callback&
    scope=profile email&
    state=RANDOM_STRING">
  Connect with Death Legion
</a>
```

### 3. Handle the callback

User clicks → Death Legion shows consent → user approves → redirected back:

```
https://myapp.com/auth/callback?code=AUTH_CODE&state=RANDOM_STRING
```

**Always validate `state`** matches what you sent — this prevents CSRF.

### 4. Exchange code for token (server-side)

```js
const response = await fetch("https://deathlegion.vercel.app/api/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    grant_type: "authorization_code",
    code: authCode,
    client_id: process.env.DL_CLIENT_ID,
    client_secret: process.env.DL_CLIENT_SECRET,
    redirect_uri: "https://myapp.com/auth/callback",
  }),
});
const tokens = await response.json();
// {
//   "access_token": "abc123...",
//   "token_type": "Bearer",
//   "expires_in": 3600,
//   "refresh_token": "def456...",
//   "scope": "profile email"
// }
```

The authorization code expires in **10 minutes** and can only be used **once**.

### 5. Call the userinfo endpoint

```js
const profileRes = await fetch("https://deathlegion.vercel.app/api/oauth/userinfo", {
  headers: { Authorization: `Bearer ${tokens.access_token}` },
});
const user = await profileRes.json();
// {
//   "id": "user_abc123",
//   "username": "admin",
//   "email": "admin@deathlegion.dev",
//   "role": "superadmin",
//   "status": "active",
//   "memberId": "mem_xyz",
//   "memberNumber": "DL-2026-4AA31",
//   "verificationStatus": "verified",
//   "primaryUnit": { "id": "...", "name": "Development", "slug": "development", "color": "#22c55e" },
//   "currentRole": "Lead Developer",
//   "joinedAt": "2026-07-01T...",
//   "scope": "profile email"
// }
```

Done. The user is now signed in to your app with their Death Legion identity.

---

## Scopes

| Scope | What it grants |
|-------|----------------|
| `profile` | Username, member number, role, joined date, verification status |
| `email` | Account email address |
| `identity` | Verified member status and verification level |
| `unit` | Primary unit info and team memberships |

Multiple scopes are space-separated: `scope=profile email unit`

---

## Refresh Tokens

Access tokens expire in **1 hour**. Use the refresh token to get a new access token without prompting the user again.

```js
const response = await fetch("https://deathlegion.vercel.app/api/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    grant_type: "refresh_token",
    refresh_token: storedRefreshToken,
    client_id: process.env.DL_CLIENT_ID,
    client_secret: process.env.DL_CLIENT_SECRET,
  }),
});
const tokens = await response.json();
// {
//   "access_token": "new_abc123...",
//   "token_type": "Bearer",
//   "expires_in": 3600,
//   "refresh_token": "new_def456...",
//   "scope": "profile email"
// }
```

**The old refresh token is revoked immediately** when a new one is issued (rotation). Always store the new refresh token.

---

## Token Introspection (RFC 7662)

For resource servers that need to validate tokens from clients:

```js
const response = await fetch("https://deathlegion.vercel.app/api/oauth/introspect", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token: accessToken,
    client_id: process.env.DL_CLIENT_ID,
    client_secret: process.env.DL_CLIENT_SECRET,
  }),
});
const result = await response.json();
// If valid:
// {
//   "active": true,
//   "scope": "profile email",
//   "client_id": "858eaba024b9b37fc6d23ddb1f2cefc4",
//   "username": "admin",
//   "sub": "user_abc123",
//   "exp": 1720000000,
//   "iat": 1719996400,
//   "token_type": "Bearer"
// }
//
// If invalid/expired/revoked:
// { "active": false }
```

---

## Token Revocation (RFC 7009)

When a user signs out of your app, revoke their Death Legion token:

```js
await fetch("https://deathlegion.vercel.app/api/oauth/revoke", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token: accessToken,         // or refresh_token
    client_id: process.env.DL_CLIENT_ID,
    client_secret: process.env.DL_CLIENT_SECRET,
  }),
});
// Returns 200 OK regardless of whether token existed.
```

---

## Consent Screen Flow (for SPA clients)

If your frontend is a SPA and you want to show the consent screen in a popup instead of redirecting the user away:

### Step 1: Fetch authorize info (no redirect)

```js
const res = await fetch(`https://deathlegion.vercel.app/api/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://myapp.com/auth/callback&
  scope=profile&
  state=xyz`);

const info = await res.json();
// {
//   "app": { "name": "My Legion App", "description": "...", "logoUrl": null, "homepageUrl": "https://myapp.com" },
//   "user": { "username": "admin", "email": "admin@deathlegion.dev" },
//   "scope": "profile",
//   "state": "xyz",
//   "clientId": "858eaba024b9b37fc6d23ddb1f2cefc4",
//   "redirectUri": "https://myapp.com/auth/callback"
// }
```

If the user is not logged in, you'll get:
```json
{ "error": "login_required", "error_description": "User must log in to authorize this app" }
```

### Step 2: Show your own consent UI using that info

### Step 3: Submit the user's decision

```js
const res = await fetch("https://deathlegion.vercel.app/api/oauth/authorize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",   // user's session cookie
  body: JSON.stringify({
    clientId: info.clientId,
    redirectUri: info.redirectUri,
    scope: info.scope,
    state: info.state,
    decision: "approve",   // or "deny"
  }),
});
const { redirect } = await res.json();
// redirect = "https://myapp.com/auth/callback?code=AUTH_CODE&state=xyz"
// Now exchange the code for tokens (Step 4 above)
```

---

## Error Handling

All errors follow the OAuth 2.0 spec (`error` + `error_description`):

| HTTP | `error` | When |
|------|---------|------|
| 400 | `invalid_request` | Missing required parameter |
| 400 | `unsupported_response_type` | `response_type` is not `code` |
| 400 | `unsupported_grant_type` | `grant_type` is not `authorization_code` or `refresh_token` |
| 400 | `invalid_grant` | Code expired, already used, or refresh token invalid |
| 400 | `invalid_request` | Redirect URI not registered |
| 401 | `invalid_client` | Wrong client_id or client_secret |
| 401 | `invalid_token` | Bearer token missing, expired, or revoked (userinfo) |
| 401 | `login_required` | User must log in before authorizing |
| 403 | `access_denied` | User denied consent (POST authorize with `decision: "deny"`) |
| 403 | `account_suspended` | User's account is banned or suspended |
| 404 | `user_not_found` | Token is valid but user no longer exists |
| 429 | `invalid_request` | Rate limit exceeded (10/min for authorize + token) |
| 500 | `server_error` | Internal server error (check response body) |

Example error response:
```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code invalid, expired, or already used"
}
```

### Callback error redirect

When the user denies consent, Death Legion redirects back to your callback with an error:
```
https://myapp.com/auth/callback?error=access_denied&error_description=User+denied+the+authorization+request&state=xyz
```

Always handle this case in your callback handler.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/oauth/authorize` | 10 per minute per IP |
| `/api/oauth/token` | 10 per minute per IP |
| `/api/oauth/userinfo` | 60 per minute per token |
| `/api/oauth/introspect` | 30 per minute per IP |
| `/api/oauth/revoke` | 10 per minute per IP |

Rate-limited responses include a `Retry-After` header (seconds).

---

## Complete Code Example — Next.js API Route

Here's a full callback handler for a Next.js app:

```ts
// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // User denied consent or other error
  if (error) {
    return NextResponse.redirect(new URL(`/?auth_error=${error}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", req.url));
  }

  // Validate state (CSRF protection)
  const expectedState = req.cookies.get("oauth_state")?.value;
  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth_error=state_mismatch", req.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://deathlegion.vercel.app/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: process.env.DL_CLIENT_ID!,
      client_secret: process.env.DL_CLIENT_SECRET!,
      redirect_uri: process.env.DL_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    console.error("Token exchange failed:", err);
    return NextResponse.redirect(new URL("/?auth_error=token_exchange_failed", req.url));
  }

  const tokens = await tokenRes.json();

  // Fetch user profile
  const profileRes = await fetch("https://deathlegion.vercel.app/api/oauth/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  // Create session in your app (e.g., set a JWT cookie)
  // ... your session logic here ...

  // Store refresh token securely for later use
  // ... your storage logic here ...

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

---

## Complete Code Example — Token Refresh

```ts
export async function refreshDeathLegionToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://deathlegion.vercel.app/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.DL_CLIENT_ID!,
      client_secret: process.env.DL_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token refresh failed: ${err.error_description ?? err.error}`);
  }

  return res.json();
}

// Usage in your auth middleware
async function getValidAccessToken(user: User) {
  if (Date.now() < user.tokenExpiresAt - 60_000) {
    return user.accessToken; // still valid
  }

  const fresh = await refreshDeathLegionToken(user.refreshToken);
  await updateUserTokens(user.id, fresh);
  return fresh.access_token;
}
```

---

## Security Checklist

- [ ] Client secret stored in environment variables, never shipped to client
- [ ] `state` parameter is a random string, validated on callback (CSRF protection)
- [ ] Redirect URI is HTTPS in production
- [ ] Refresh tokens rotated on each use (Death Legion does this automatically)
- [ ] Tokens stored in HTTP-only cookies, not localStorage
- [ ] Revoke tokens on user sign-out
- [ ] Validate `state` length and format
- [ ] Handle `access_denied` error in callback
- [ ] Implement token refresh before access token expires
- [ ] Use PKCE if your client can't keep a secret (SPA, mobile — coming soon)

---

## Sample App: "Connect with Death Legion" Button

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
  <style>
    .dl-connect {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: #b3312c;
      color: #e7e3d6;
      border: 1px solid #b3312c;
      border-radius: 2px;
      font-family: monospace;
      font-size: 13px;
      text-decoration: none;
      transition: all 0.25s;
    }
    .dl-connect:hover {
      background: #d63f39;
      border-color: #d63f39;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <a class="dl-connect" href="https://deathlegion.vercel.app/api/oauth/authorize?
      response_type=code&
      client_id=YOUR_CLIENT_ID&
      redirect_uri=https://myapp.com/auth/callback&
      scope=profile email&
      state={{RANDOM_STATE}}">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 1 22 6v6c0 6-4.2 9.8-10 11C6.2 21.8 2 18 2 12V6l10-5z" stroke="#e7e3d6" stroke-width="1.4"/>
    </svg>
    Connect with Death Legion
  </a>
</body>
</html>
```

---

## Admin API — Manage OAuth Apps

Admins can manage OAuth apps via the dashboard UI or via API:

### List apps
```http
GET /api/oauth/apps
Authorization: Bearer <admin-session-cookie>
```

### Create app
```http
POST /api/oauth/apps
Authorization: Bearer <admin-session-cookie>
Content-Type: application/json

{
  "name": "My Legion App",
  "description": "What it does",
  "homepageUrl": "https://myapp.com",
  "redirectUris": ["https://myapp.com/auth/callback"]
}
```

### Update app
```http
PATCH /api/oauth/apps/{id}
Authorization: Bearer <admin-session-cookie>
Content-Type: application/json

{
  "name": "Updated Name",
  "active": false,
  "redirectUris": ["https://myapp.com/auth/callback", "https://myapp.com/auth/callback2"]
}
```

To rotate the client secret:
```json
{ "rotateSecret": true }
```

### Delete app
```http
DELETE /api/oauth/apps/{id}
Authorization: Bearer <admin-session-cookie>
```

All changes are recorded in the audit log.

---

## FAQ

**Can I use Death Legion OAuth without a backend?**
No. The client secret must be kept server-side. For SPA/mobile clients, PKCE support is coming soon.

**How long do access tokens last?**
1 hour (3600 seconds).

**How long do refresh tokens last?**
Until revoked. They're rotated on each use — the old one stops working immediately.

**How long do authorization codes last?**
10 minutes. They can only be used once.

**Can a user revoke access without going to my app?**
Yes — Death Legion members can revoke access from their security center. Your app will start getting `invalid_token` errors from `/api/oauth/userinfo`. Handle this gracefully by prompting re-auth.

**What happens if an admin disables my OAuth app?**
All existing tokens stop working immediately. New authorizations are rejected with `invalid_client`.

**Is HTTPS required?**
Yes, in production. Redirect URIs must be HTTPS (except `http://localhost` for development).

**Can I have multiple redirect URIs?**
Yes — register one per line when creating/editing the app. The `redirect_uri` parameter must match exactly.

---

## Support

- Issues: open a ticket in the Death Legion admin dashboard
- Audit trail: every OAuth action (app created, app updated, app deleted, token issued, token revoked) is recorded in the audit log
- Rate limits: 10 requests per minute per IP for authorize + token endpoints
