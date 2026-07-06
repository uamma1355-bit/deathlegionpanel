# 01 — Target Architecture

## 1. High-level diagram

```
┌──────────────────────────┐         ┌─────────────────────────────┐
│   Frontend (Vercel)      │         │   Backend (Linux server)    │
│   React + TypeScript     │         │   Laravel 9 + PHP 8.2       │
│   Vite build             │         │                             │
│                          │  HTTPS  │                             │
│   • Auth context         │ ──────► │   /api/client/*   (Sanctum) │
│   • Axios + interceptors │ ◄────── │   /api/application/* (tok)  │
│   • React Router         │   WSS   │   /api/remote/* (Wings JWT) │
│   • Permission guards    │ ──────► │   /broadcasting/auth        │
│   • WebSocket client     │ ◄────── │   /sanctum/csrf-cookie      │
│                          │         │                             │
│   Env:                   │         │   Env:                      │
│   VITE_API_URL           │         │   APP_KEY, DB_*, REDIS_*    │
│   VITE_WS_URL            │         │   SANCTUM_STATEFUL_DOMAINS  │
└──────────────────────────┘         └─────────────┬───────────────┘
                                                  │
                                                  │ Panel → Wings
                                                  │ Bearer {decrypted
                                                  │   daemon_token}
                                                  ▼
                                    ┌─────────────────────────────┐
                                    │   Wings (daemon)            │
                                    │   on each Node              │
                                    │   unchanged                 │
                                    └─────────────────────────────┘
```

## 2. Component boundaries

### 2.1 Frontend (`/frontend`)

A standalone Vite + React + TypeScript SPA. No PHP, no Blade, no Laravel Mix.

| Layer | Responsibility | Key files |
|-------|----------------|-----------|
| Config | Env-driven runtime config | `src/config/env.ts` |
| HTTP | Axios instance, interceptors, error normalization | `src/api/http.ts`, `src/api/interceptors.ts` |
| API surface | One typed function per backend endpoint | `src/api/**/*.ts` |
| Auth | Login, 2FA, logout, password reset, session | `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts` |
| Permissions | Client-side route + UI guards | `src/auth/PermissionRoute.tsx`, `src/auth/Can.tsx` |
| WebSocket | Reconnecting WS client for console | `src/api/ws/useServerWebSocket.ts` |
| Routing | React Router v6, protected routes | `src/router.tsx` |
| State | React Query (server state) + React Context (auth/UI) | `src/state/` |
| Pages | One per route | `src/pages/**/*.tsx` |
| Components | Reusable UI | `src/components/` |
| i18n | i18next + lazy-loaded JSON | `src/i18n/` |
| Error boundary | Top-level + per-route | `src/components/ErrorBoundary.tsx` |

The frontend talks to the backend exclusively via:
- HTTPS for `/api/client/*`, `/api/application/*`, `/api/remote/*` (only file download/upload signed URLs hit Wings directly — same as the original).
- WSS for the server console.
- `GET /sanctum/csrf-cookie` before any non-GET mutation (Sanctum SPA flow).

### 2.2 Backend (`/backend`)

A Laravel 9 application, API-only on the user-facing surface. The admin web surface
is kept as Blade for now (see [11-AdminAreaStrategy.md](./11-AdminAreaStrategy.md)).

| Layer | Responsibility | Key files |
|-------|----------------|-----------|
| Routes | Three API surfaces + admin web | `routes/api-client.php`, `routes/api-application.php`, `routes/api-remote.php`, `routes/admin.php`, `routes/auth.php` |
| Middleware | Sanctum, CORS, JSON enforcement, activity | `app/Http/Middleware/` |
| Controllers | Thin, delegate to services | `app/Http/Controllers/Api/` |
| Services | Domain logic (reused from upstream) | `app/Services/` |
| Repositories | Eloquent + Wings (reused from upstream) | `app/Repositories/` |
| Models | Eloquent (unchanged from upstream) | `app/Models/` |
| Transformers | Spatie Fractal + JSON:API serializer | `app/Transformers/Api/` |
| Wings comm | Daemon repositories — byte-identical to upstream | `app/Repositories/Wings/` |
| JWT signing | `NodeJWTService` — HMAC-SHA256 keyed by node daemon_token | `app/Services/Nodes/NodeJWTService.php` |
| Jobs | `RunTaskJob` + future async work | `app/Jobs/` |
| Events/Observers | Activity logging pipeline (unchanged) | `app/Events/`, `app/Observers/` |

### 2.3 Shared (`/shared`)

TypeScript types and Zod schemas that mirror the backend's JSON:API responses.
Consumed by the frontend at build time. NOT a runtime dependency — the frontend
imports these as plain TS source.

| File | Purpose |
|------|---------|
| `shared/types/user.ts` | `User`, `UserRole`, `UserResponse` |
| `shared/types/server.ts` | `Server`, `ServerStats`, `ServerRelationships` |
| `shared/types/node.ts` | `Node`, `NodeStats` |
| `shared/types/api.ts` | JSON:API envelope: `{ object, attributes, relationships, meta }` |
| `shared/types/permission.ts` | 35 string permission constants + RBAC helpers |
| `shared/schemas/*.ts` | Zod schemas for runtime validation of API responses |

## 3. Data flow — concrete examples

### 3.1 Login (Sanctum SPA flow, cookie-based)

```
1. FE: GET  {API}/sanctum/csrf-cookie     → sets XSRF-TOKEN + pterodactyl_session cookies
2. FE: POST {API}/api/client/auth/login    { email, password }
                                          → if 2FA: 400 { errors: [{ code: '2fa_required' }] }
3. FE: POST {API}/api/client/auth/login-checkpoint { confirmation_token, code }
                                          → 204 No Content
4. FE: GET  {API}/api/client/account       → user JSON (drives AuthContext)
```

The session cookie is `SameSite=Lax` by default. For cross-domain Vercel → API
deployments we **also** support bearer tokens (see §4 below).

### 3.2 Server console (WebSocket)

```
1. FE: GET {API}/api/client/servers/{uuid}/websocket
        → { data: { token: "<jwt>", socket: "wss://node-1.example.com/api/servers/<uuid>/ws" } }
2. FE: opens WSS to node-1, sends `{ "event": "auth", "args": ["<jwt>"] }`
3. Wings validates JWT signature (HMAC-SHA256 keyed by node daemon_token, same as upstream)
4. Wings streams console output, stats, and accepts { event: "send logs" | "send stats" | "send command" | "set state" }
5. FE: reconnect logic with exponential backoff (1s → 30s cap)
```

### 3.3 File upload (direct to Wings)

Same as upstream — the frontend requests a signed URL from the panel and uploads
directly to Wings, bypassing the panel for the bytes:

```
1. FE: GET  {API}/api/client/servers/{uuid}/files/upload → { data: { url, attributes: { ... } } }
2. FE: POST {signed URL on Wings} multipart file upload, with the JWT query string
```

This must stay byte-identical because Wings enforces the JWT.

## 4. Authentication model

Two parallel auth schemes are supported by the backend, both implemented through
Laravel Sanctum:

| Scheme | Use case | Header | Storage |
|--------|----------|--------|---------|
| Sanctum SPA (cookie) | Frontend on same root domain as API (e.g. `panel.example.com` + `api.example.com` under `.example.com`) | `Cookie: pterodactyl_session` | httpOnly cookie, browser-managed |
| Sanctum bearer token | Frontend on a different TLD (e.g. Vercel preview URLs) | `Authorization: Bearer ptlc_...` | localStorage, axios interceptor |

The frontend detects which mode to use via `VITE_AUTH_MODE=cookie|token`.
Default: `cookie`. Token mode is opt-in because it requires the user to generate
an API key in their account first — appropriate for power users / Vercel preview
deployments but not the primary UX.

The original Pterodactyl client API keys (`ptlc_`, `ptla_`) are reused unchanged.
Sanctum's `personalAccessTokenModel` is bound to `ApiKey` (same as upstream).

## 5. CORS

`config/cors.php` is configured to allow:
- Origins: env-driven `SANCTUM_STATEFUL_DOMAINS` (comma-separated).
- Paths: `api/*`, `sanctum/csrf-cookie`, `login`, `logout`.
- Methods: `*`.
- Headers: `*`.
- Credentials: `true`.

For Vercel preview deployments, set `SANCTUM_STATEFUL_DOMAINS=*.vercel.app,panel.example.com`.

## 6. What stays byte-identical to upstream

| Surface | Why |
|---------|-----|
| Database schema | Migrations unchanged — zero data migration risk. |
| Wings HTTP protocol (Panel → Wings) | Wings is a separate binary; must keep accepting the same Bearer + endpoints. |
| Wings WebSocket JWT (Panel → client → Wings) | Wings validates HMAC-SHA256 with the node daemon_token. |
| `/api/remote/*` (Wings → Panel callbacks) | Wings posts back here; auth is `Bearer {daemon_token_id}.{decrypted_daemon_token}`. |
| Sanctum token format (`ptlc_`, `ptla_`) | Existing API consumers depend on this. |
| JSON:API response envelope (Fractal + `JsonApiSerializer`) | Existing API consumers parse this. |
| Permission strings (`control.console`, `file.read`, `backup.read`, etc.) | Subuser UI and Application API depend on these. |

## 7. What changes

| Surface | Change |
|---------|--------|
| Auth views | Blade → React (login, 2FA, forgot/reset password, account). |
| Dashboard | Already React — ported to standalone Vite, axios base URL made env-driven. |
| Server area | Already React — same as dashboard. |
| Admin area | **Unchanged Blade** for Phase 1. See [11-AdminAreaStrategy.md](./11-AdminAreaStrategy.md). |
| Session cookie domain | Must be configured to span frontend + API (or use bearer tokens). |
| CSRF cookie | Sanctum's `XSRF-TOKEN`, fetched via `/sanctum/csrf-cookie` before mutations. |
| Build pipeline | Laravel Mix (webpack) → Vite. |

## 8. Module dependency rule

The frontend **MUST NOT** import anything from `pterodactyl-source/`. The
`shared/` package is the only contract between the two applications. The
backend owns the database, the service layer, and the Wings protocol — the
frontend owns the rendering and the user interaction.
