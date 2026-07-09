# Legion Auth — Integration Guide

Death Legion's authentication system lets any Legion app verify member identity using a single Death Legion ID. This document covers everything you need to integrate Legion Auth into your app.

---

## Table of Contents

1. [Overview](#overview)
2. [How Legion Auth Works](#how-it-works)
3. [Prerequisites](#prerequisites)
4. [Quick Start: Email + Password Login](#quick-start-email)
5. [Quick Start: Phone OTP Login](#quick-start-phone)
6. [Session Management](#sessions)
7. [API Reference](#api-reference)
8. [Integration Examples](#examples)
9. [Security Best Practices](#security)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Legion Auth is the central identity provider for all Death Legion applications. One Death Legion ID works across:

- The recruitment platform
- Member dashboards
- The mobile workspace app
- Internal tools and bots
- Third-party integrations

Members sign in with either:
- **Email + password** (with optional MFA)
- **Phone number + OTP code** (6-digit code sent via SMS)

Both methods produce the same session — your app just needs to check if the session is valid.

---

## How It Works

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Your App    │────▶│  Legion Auth API │────▶│  DL Database │
│              │◀────│  /api/session    │     │              │
└──────────────┘     └──────────────────┘     └──────────────┘
```

1. User logs in through the Death Legion platform (web or mobile)
2. A session cookie is set (`next-auth.session-token`)
3. Your app calls `GET /api/session` with the cookie
4. If the session is valid, you get back the user's ID, username, role, and member info
5. Your app uses this to authorize the user

---

## Prerequisites

- Your app must be able to make HTTP requests to the Death Legion platform
- Users must have a Death Legion account (registered through the platform)
- If your app runs on a different domain, you'll need to use token-based auth (see [Cross-Domain](#cross-domain))

---

## Quick Start: Email + Password Login {#quick-start-email}

### 1. Send login request

```http
POST /api/auth/callback/credentials
Content-Type: application/json

{
  "identifier": "user@example.com",
  "password": "their-password",
  "mfaCode": ""
}
```

The response sets a `next-auth.session-token` cookie. If the user has MFA enabled, include the 6-digit code in `mfaCode`.

### 2. Verify the session

```http
GET /api/session
Cookie: next-auth.session-token=<token>
```

Response:
```json
{
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "username": "username",
    "role": "member",
    "status": "active",
    "memberId": "def456"
  }
}
```

If `user` is `null`, the session is invalid or expired.

---

## Quick Start: Phone OTP Login {#quick-start-phone}

### Step 1: Send OTP code

```http
POST /api/auth/phone/send
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

Response:
```json
{
  "ok": true,
  "mode": "login",
  "expiresAt": "2026-07-09T16:00:00Z",
  "devCode": "123456"
}
```

> `devCode` is only returned in development mode. In production, the code is sent via SMS.

### Step 2: Verify the code

```http
POST /api/auth/phone/verify
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "code": "123456"
}
```

Response:
```json
{
  "ok": true,
  "mode": "login",
  "userId": "abc123",
  "email": "user@example.com",
  "username": "username"
}
```

### Step 3: Create a session

```http
POST /api/auth/phone/session
Content-Type: application/json

{
  "userId": "abc123"
}
```

This sets the `next-auth.session-token` cookie. Your app can now call `/api/session` to verify the user.

---

## Session Management {#sessions}

### Checking if a user is logged in

```javascript
const res = await fetch('https://applydeathlegionteam.vercel.app/api/session', {
  credentials: 'include'
});
const data = await res.json();

if (data.user) {
  console.log('Logged in as:', data.user.username);
  console.log('Role:', data.user.role);
  console.log('Member ID:', data.user.memberId);
} else {
  console.log('Not logged in');
}
```

### Session expiry

Sessions last 30 days. The session is automatically renewed on each request.

### Logging out

Send a request to the NextAuth signout endpoint:

```http
POST /api/auth/signout
```

Or clear the `next-auth.session-token` cookie.

---

## API Reference {#api-reference}

### `GET /api/session`
Returns the current user or `null`.

**Response:**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "username": "string",
    "role": "applicant | member | admin | superadmin",
    "status": "active | suspended | banned",
    "memberId": "string | null"
  }
}
```

### `POST /api/auth/phone/send`
Sends a 6-digit OTP code to a phone number.

**Request:**
```json
{ "phoneNumber": "+1234567890" }
```

For registration, also include:
```json
{
  "phoneNumber": "+1234567890",
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

### `POST /api/auth/phone/verify`
Verifies the OTP code.

**Request (login):**
```json
{ "phoneNumber": "+1234567890", "code": "123456" }
```

**Request (registration):**
```json
{
  "phoneNumber": "+1234567890",
  "code": "123456",
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

### `POST /api/auth/phone/session`
Creates a session for a phone-verified user.

**Request:**
```json
{ "userId": "abc123" }
```

Sets the session cookie.

### `GET /api/members/:id`
Returns full member profile (requires authentication + member access).

### `GET /api/units`
Returns all Death Legion units.

### `GET /api/directory?q=search`
Search the member directory.

---

## Integration Examples {#examples}

### Example 1: Next.js App

```typescript
// lib/legion-auth.ts
export async function getLegionUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const res = await fetch('https://applydeathlegionteam.vercel.app/api/session', {
    headers: { cookie },
  });
  const data = await res.json();
  return data.user;
}

// app/dashboard/page.tsx
import { getLegionUser } from '@/lib/legion-auth';

export default async function Dashboard(req: Request) {
  const user = await getLegionUser(req);
  if (!user) {
    return redirect('https://applydeathlegionteam.vercel.app/');
  }
  return <div>Welcome, {user.username}</div>;
}
```

### Example 2: Kotlin Android App

```kotlin
// ApiClient.kt
class LegionAuth(private val baseUrl: String) {
    private val client = HttpClient {
        install(ContentNegotiation) { json() }
        install(HttpCookies) { storage = AcceptAllCookiesStorage() }
    }

    suspend fun loginWithPhone(phoneNumber: String): PhoneSendResponse {
        return client.post("$baseUrl/api/auth/phone/send") {
            contentType(ContentType.Application.Json)
            setBody(PhoneSendRequest(phoneNumber))
        }.body()
    }

    suspend fun verifyOtp(phoneNumber: String, code: String): PhoneVerifyResponse {
        return client.post("$baseUrl/api/auth/phone/verify") {
            contentType(ContentType.Application.Json)
            setBody(PhoneVerifyRequest(phoneNumber, code))
        }.body()
    }

    suspend fun createSession(userId: String) {
        client.post("$baseUrl/api/auth/phone/session") {
            contentType(ContentType.Application.Json)
            setBody(mapOf("userId" to userId))
        }
    }

    suspend fun getCurrentUser(): SessionUser? {
        return try {
            client.get("$baseUrl/api/session").body<SessionResponse>().user
        } catch (e: Exception) { null }
    }
}

// Usage
val auth = LegionAuth("https://applydeathlegionteam.vercel.app")
val sendRes = auth.loginWithPhone("+1234567890")
// User enters code from SMS
val verifyRes = auth.verifyOtp("+1234567890", "123456")
if (verifyRes.ok) {
    auth.createSession(verifyRes.userId)
    val user = auth.getCurrentUser()
    println("Logged in as ${user?.username}")
}
```

### Example 3: Python / Flask

```python
import requests

BASE_URL = "https://applydeathlegionteam.vercel.app"
session = requests.Session()

# Phone OTP login
def login_with_phone(phone_number):
    # Step 1: Send OTP
    resp = session.post(f"{BASE_URL}/api/auth/phone/send",
                        json={"phoneNumber": phone_number})
    data = resp.json()
    if not data["ok"]:
        raise Exception(data.get("error", "Failed to send code"))

    # Step 2: User enters code
    code = input("Enter the 6-digit code: ")

    # Step 3: Verify
    resp = session.post(f"{BASE_URL}/api/auth/phone/verify",
                        json={"phoneNumber": phone_number, "code": code})
    data = resp.json()
    if not data["ok"]:
        raise Exception(data.get("error", "Verification failed"))

    # Step 4: Create session
    session.post(f"{BASE_URL}/api/auth/phone/session",
                 json={"userId": data["userId"]})

    # Step 5: Verify session
    resp = session.get(f"{BASE_URL}/api/session")
    user = resp.json()["user"]
    print(f"Logged in as {user['username']} (role: {user['role']})")
    return user

# Usage
user = login_with_phone("+1234567890")
```

### Example 4: cURL

```bash
# Send OTP
curl -c cookies.txt -X POST https://applydeathlegionteam.vercel.app/api/auth/phone/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890"}'

# Verify OTP (replace 123456 with the actual code)
curl -c cookies.txt -X POST https://applydeathlegionteam.vercel.app/api/auth/phone/verify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890","code":"123456"}'

# Create session
curl -c cookies.txt -X POST https://applydeathlegionteam.vercel.app/api/auth/phone/session \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID_FROM_PREVIOUS_RESPONSE"}'

# Check session
curl -b cookies.txt https://applydeathlegionteam.vercel.app/api/session
```

---

## Cross-Domain Integration {#cross-domain}

If your app runs on a different domain than the Death Legion platform, cookies won't be sent automatically. Use this approach:

### Token-based flow

1. User logs in on the Death Legion platform
2. Your app opens a popup to `https://applydeathlegionteam.vercel.app/api/session`
3. The platform returns the user data as JSON (with CORS headers)
4. Your app stores the user info and uses the API token for subsequent requests

```javascript
// Check if user is logged in to Death Legion
const res = await fetch('https://applydeathlegionteam.vercel.app/api/session', {
  credentials: 'include',
});
const data = await res.json();

if (data.user) {
  // User is logged in to Death Legion
  // Use their ID for your app's authorization
  localStorage.setItem('dl_user', JSON.stringify(data.user));
}
```

---

## Security Best Practices {#security}

1. **Always verify sessions server-side** — never trust client-side session checks alone
2. **Use HTTPS** — the session cookie is only sent over HTTPS in production
3. **Check user status** — verify `status === "active"` before granting access
4. **Check user role** — use `role` to determine access levels (`member`, `admin`, `superadmin`)
5. **Handle expired sessions** — if `/api/session` returns `null`, redirect to login
6. **Rate limit OTP requests** — the platform limits OTP sends, but your app should too
7. **Store passwords securely** — if your app has its own auth, use the Death Legion password hash (scrypt)
8. **Use MFA when available** — check `mfaEnabled` and prompt for MFA code

---

## Roles and Permissions

| Role | Description |
|------|-------------|
| `applicant` | Registered but not yet approved. Can only access the application wizard. |
| `member` | Approved member. Can access dashboard, directory, profile, resources. |
| `admin` | Platform administrator. Can review applications, manage members, view audit logs. |
| `superadmin` | Full access. Cannot be banned. Can do everything an admin can. |

---

## Troubleshooting {#troubleshooting}

### "No session" even after login

- Check that cookies are being sent (`credentials: 'include'` in fetch, `withCredentials: true` in axios)
- Verify the cookie name: `next-auth.session-token` (dev) or `__Secure-next-auth.session-token` (prod)
- Check that your app and the platform are on the same domain or using cross-domain flow

### OTP code not received

- In development, the code is returned in the API response as `devCode`
- In production, the code is sent via SMS (configure an SMS provider)
- Codes expire after 5 minutes
- Maximum 5 verification attempts per code

### "Account suspended" error

- The user's `status` is `suspended` or `banned`
- Only a superadmin can reinstate accounts

### CORS errors

- The platform allows cross-origin requests to `/api/session`
- For other endpoints, you may need to proxy through your own server

---

## Support

- Platform URL: https://applydeathlegionteam.vercel.app
- Admin contact: admin@deathlegion.dev
- API base URL: https://applydeathlegionteam.vercel.app

---

*Death Legion · Built internally. Not for resale.*
