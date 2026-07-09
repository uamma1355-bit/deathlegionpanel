# Legion Auth — Integration Guide

Death Legion's authentication system lets any Legion app verify member identity using a single Death Legion ID.

---

## Table of Contents

1. [Overview](#overview)
2. [OAuth2 Provider (Connect with Death Legion)](#oauth2)
3. [Phone OTP Login](#phone-otp)
4. [Session API](#session-api)
5. [Integration Examples](#examples)
6. [Admin: Register OAuth Apps](#register-apps)

---

## Overview

Legion Auth is the central identity provider for all Death Legion applications. Members sign in with either:
- **Email + password** (with optional MFA)
- **Phone number + OTP code**

Third-party apps can integrate via **OAuth2** — users click "Connect with Death Legion", approve in a popup, and the app gets an access token.

---

## OAuth2 Provider (Connect with Death Legion) {#oauth2}

Death Legion is a full OAuth2 provider. Other apps can let users "Connect with Death Legion" just like "Connect with Google".

### Flow

```
Your App                 Death Legion                User
   |                          |                        |
   |--- redirect to /authorize --->|                   |
   |                          |--- show consent --->  |
   |                          |<-- user approves ---  |
   |<-- redirect with code ---|                        |
   |--- POST /token ---------->|                        |
   |<-- access_token ----------|                        |
   |--- GET /userinfo -------->|                        |
   |<-- user profile ----------|                        |
```

### Step 1: Register your app (admin)

Admin creates an OAuth app in the admin dashboard → OAuth Apps tab. This gives you:
- `client_id`
- `client_secret`
- Redirect URIs (registered)

### Step 2: Redirect user to authorize

```
GET https://deathlegion.vercel.app/api/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=profile&
  state=RANDOM_STRING
```

If the user is logged in, they see a consent screen. If already authorized, they're redirected automatically.

### Step 3: Handle the redirect

The user is redirected back to your `redirect_uri` with a `code`:

```
https://yourapp.com/callback?code=AUTH_CODE&state=RANDOM_STRING
```

### Step 4: Exchange code for token

```bash
curl -X POST https://deathlegion.vercel.app/api/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "YOUR_REDIRECT_URI"
  }'
```

Response:
```json
{
  "access_token": "abc123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "def456...",
  "scope": "profile"
}
```

### Step 5: Get user info

```bash
curl https://deathlegion.vercel.app/api/oauth/userinfo \
  -H "Authorization: Bearer abc123..."
```

Response:
```json
{
  "id": "user_id",
  "username": "johndoe",
  "email": "john@example.com",
  "role": "member",
  "status": "active",
  "memberId": "member_id",
  "memberNumber": "DL-2026-ABC12",
  "verificationStatus": "verified",
  "primaryUnit": {
    "id": "unit_id",
    "name": "Development",
    "slug": "development",
    "color": "#22c55e"
  },
  "currentRole": "Backend Developer",
  "joinedAt": "2026-07-09T..."
}
```

### Step 6: Refresh token

```bash
curl -X POST https://deathlegion.vercel.app/api/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "code": "YOUR_REFRESH_TOKEN",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET"
  }'
```

---

## Popup Integration (JavaScript)

```javascript
// Open the authorize URL in a popup
function connectWithDeathLegion(clientId, redirectUri) {
  const state = Math.random().toString(36).slice(2);
  const authUrl = `https://deathlegion.vercel.app/api/oauth/authorize?` +
    `response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=profile&state=${state}`;

  const popup = window.open(authUrl, 'dl-auth', 'width=500,height=600');

  // Listen for the redirect
  window.addEventListener('message', (event) => {
    if (event.data.type === 'dl-oauth-callback') {
      popup.close();
      const { code, state: returnedState } = event.data;
      if (returnedState !== state) return; // CSRF check

      // Exchange code for token
      fetch('/api/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri })
      }).then(r => r.json()).then(data => {
        console.log('Access token:', data.access_token);
        // Store token, fetch user info, etc.
      });
    }
  });
}

// In your callback page (redirect_uri):
// Send the code back to the opener window
<script>
  const params = new URLSearchParams(window.location.search);
  window.opener.postMessage({
    type: 'dl-oauth-callback',
    code: params.get('code'),
    state: params.get('state')
  }, '*');
  window.close();
</script>
```

---

## Phone OTP Login {#phone-otp}

### Send OTP

```bash
curl -X POST https://deathlegion.vercel.app/api/auth/phone/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890"}'
```

### Verify OTP

```bash
curl -X POST https://deathlegion.vercel.app/api/auth/phone/verify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890","code":"123456"}'
```

### Create session

```bash
curl -X POST https://deathlegion.vercel.app/api/auth/phone/session \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID_FROM_VERIFY"}'
```

---

## Session API {#session-api}

```bash
curl https://deathlegion.vercel.app/api/session \
  -H "Cookie: next-auth.session-token=TOKEN"
```

Returns `{ user: null }` if not logged in, or the user object.

---

## Integration Examples {#examples}

### Next.js

```typescript
// Redirect to Death Legion OAuth
export function redirectToDeathLegion() {
  const clientId = process.env.DL_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${window.location.origin}/callback`);
  const state = crypto.randomUUID();
  localStorage.setItem('dl-oauth-state', state);
  window.location.href = `https://deathlegion.vercel.app/api/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=profile&state=${state}`;
}

// In /callback page:
export async function handleCallback(req) {
  const { code, state } = req.query;
  if (state !== req.cookies.get('dl-oauth-state')) throw new Error('State mismatch');

  const tokenRes = await fetch('https://deathlegion.vercel.app/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.DL_CLIENT_ID,
      client_secret: process.env.DL_CLIENT_SECRET,
      redirect_uri: `${req.headers.origin}/callback`
    })
  });
  const tokens = await tokenRes.json();

  const userRes = await fetch('https://deathlegion.vercel.app/api/oauth/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const user = await userRes.json();
  // user.username, user.memberNumber, user.primaryUnit, etc.
}
```

### Python

```python
import requests

BASE = "https://deathlegion.vercel.app"

# Exchange code for token
resp = requests.post(f"{BASE}/api/oauth/token", json={
    "grant_type": "authorization_code",
    "code": code,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": REDIRECT_URI
})
tokens = resp.json()

# Get user info
resp = requests.get(f"{BASE}/api/oauth/userinfo", headers={
    "Authorization": f"Bearer {tokens['access_token']}"
})
user = resp.json()
print(f"Connected as {user['username']} (DL ID: {user['memberNumber']})")
```

### Kotlin (Android)

```kotlin
// Open browser to authorize URL
val authUrl = "https://deathlegion.vercel.app/api/oauth/authorize?" +
    "response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&scope=profile&state=$state"
val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
startActivity(intent)

// In your callback activity, extract the code from the URI
// Then exchange it:
suspend fun exchangeCode(code: String): TokenResponse {
    return client.post("$BASE/api/oauth/token") {
        contentType(ContentType.Application.Json)
        setBody(mapOf(
            "grant_type" to "authorization_code",
            "code" to code,
            "client_id" to CLIENT_ID,
            "client_secret" to CLIENT_SECRET,
            "redirect_uri" to REDIRECT_URI
        ))
    }.body()
}

suspend fun getUserInfo(accessToken: String): DLUser {
    return client.get("$BASE/api/oauth/userinfo") {
        header("Authorization", "Bearer $accessToken")
    }.body()
}
```

---

## Admin: Register OAuth Apps {#register-apps}

1. Log in as admin
2. Go to Admin Dashboard → OAuth Apps
3. Click "New app"
4. Fill in: name, description, homepage URL, redirect URIs (one per line)
5. You'll get a `client_id` and `client_secret`
6. Use these in your app's OAuth configuration

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/authorize` | GET | Show consent screen (or auto-redirect if already authorized) |
| `/api/oauth/authorize` | POST | User approves — generate code + redirect |
| `/api/oauth/token` | POST | Exchange code for access token (or refresh token) |
| `/api/oauth/userinfo` | GET | Get user profile with Bearer token |
| `/api/oauth/apps` | GET/POST | Admin: list/create OAuth apps |
| `/api/oauth/apps/[id]` | DELETE | Admin: delete an OAuth app |
| `/api/session` | GET | Check current session |
| `/api/auth/phone/send` | POST | Send OTP code |
| `/api/auth/phone/verify` | POST | Verify OTP code |
| `/api/auth/phone/session` | POST | Create session after phone verification |

---

## Security

- Authorization codes expire in 10 minutes and can only be used once
- Access tokens expire in 1 hour
- Refresh tokens are supported
- Client secrets must be kept server-side (never expose in client code)
- State parameter should be used to prevent CSRF
- All endpoints enforce HTTPS in production

---

*Death Legion · Built internally. Not for resale.*
