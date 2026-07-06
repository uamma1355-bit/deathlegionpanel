# Pterodactyl Decoupled — Final Deliverable Summary

## What was built

Transformed the official Pterodactyl Panel (`v1.11.3`) into a decoupled
**React/TypeScript frontend** (Vercel-deployable) + **Laravel/PHP backend**
(independently deployable), with **byte-identical Wings compatibility**.

## Phase 1 — Analysis (complete)

- Cloned `pterodactyl/panel@v1.11.3` (553 PHP files, 51 Blade, 286 TS/TSX).
- Three parallel sub-agent analyses produced a 2,120-line `worklog.md` covering:
  - All 6 route files (base, admin, auth, api-application, api-client, api-remote)
  - All 14 custom middleware + effective stacks per surface
  - Auth flow (login, 2FA checkpoint, password reset, logout) + rate limits
  - Session vs API auth (Sanctum hybrid) + CSRF surface
  - WebSocket endpoint + JWT claims + Wings protocol
  - All 35 subuser permissions + AdminAcl bitmask
  - All 29 Eloquent models + table schemas reconstructed from 193 migrations
  - All ~50 service classes + 22 Eloquent repositories + 8 Wings repositories
  - Panel → Wings HTTP surface (Bearer: decrypted daemon_token)
  - Wings → Panel callback surface (Bearer: daemon_token_id.decrypted_daemon_token)
  - HMAC-SHA256 JWT signing via `NodeJWTService` (keyed by node daemon_token)
  - Activity logging pipeline, events, observers, notifications, jobs
  - All 50 Blade templates + React shell mount point + window globals
  - All 19 React screens + router structure
  - Complete axios API surface (60 functions across 36 files)
  - JSON:API response envelope contract

- Produced 11 structured docs in `docs/`:
  - `00-README.md` — index
  - `01-Architecture.md` — target architecture + data flow diagrams
  - `02-MigrationStrategy.md` — phased plan
  - `03-SourceAnalysis-Models.md` — models/services/Wings/JWT/schema
  - `04-SourceAnalysis-Routes.md` — routes/middleware/auth/CSRF/RBAC
  - `05-SourceAnalysis-Frontend.md` — Blade/React/router/axios
  - `06-APIContract.md` — every endpoint, body, response
  - `07-WingsCompatibility.md` — non-negotiable byte-identical surface
  - `08-RiskRegister.md` — risks, mitigations, explicit out-of-scope
  - `09-DeploymentGuide.md` — Vercel + Linux + Nginx + Caddy
  - `10-LocalDevGuide.md` — Docker dev stack + debugging
  - `11-AdminAreaStrategy.md` — why admin stays Blade for now

## Phase 2 — Scaffold + Vertical Slice (complete)

### `frontend/` — Vite + React 18 + TypeScript (strict)

- **Config**: env-driven runtime config supporting both Sanctum cookie mode
  (default, same-domain) and Bearer token mode (opt-in, cross-domain Vercel
  previews). `window.__ENV__` fallback for runtime injection.
- **HTTP**: axios instance with request interceptor (cookie: XSRF-TOKEN,
  token: Authorization Bearer) + response interceptor (normalizes 2FA
  challenge into typed `TwoFactorRequiredError`, normalizes network/HTTP
  errors into `NormalizedApiError`, clears token on 401 in token mode).
- **Auth**: `AuthProvider` (single source of truth, restores session on
  mount via `/api/client/account`), `useAuth()`, `<AuthenticatedRoute>`,
  `<PermissionRoute permission="...">`, `<AdminRoute>`, `<Can>`.
- **WebSocket**: `openServerWebSocket()` using `sockette`. Auto-reconnect
  with backoff. Handles `auth`, `auth success`, `token expiring`
  (re-auth in place), `token expired` (full reconnect). Subscribe API.
  React hook `useServerWebSocket()` wraps it with proper lifecycle.
- **State**: React Query for server state (smart retry — no 4xx), React
  Context for auth + per-server context (server + permissions + isOwner).
- **Pages implemented**:
  - `LoginPage` (handles 2FA redirect via query string)
  - `LoginCheckpointPage` (TOTP code OR recovery code)
  - `ForgotPasswordPage`
  - `ResetPasswordPage`
  - `DashboardPage` (server list with status pills)
  - `AccountPage` (read-only — Phase 3 adds edit/2FA/SSH/API keys)
  - `ServerConsolePage` (full vertical slice: WS-backed console, power
    buttons gated by permissions, command input, state pill, auto-scroll)
- **Pages stubbed** (Phase 3): files, backups, schedules, users, databases,
  network, startup, settings, activity — nav appears with permission
  gating, page shows "Phase 3" placeholder.
- **i18n**: i18next with English locale.
- **Build validation**:
  - `tsc --noEmit` — 0 errors (strict, noUncheckedIndexedAccess, noUnusedLocals, noUnusedParameters)
  - `eslint . --max-warnings 0` — 0 errors, 0 warnings
  - `vite build` — 273 modules, 142KB gzipped total JS, 3.55KB gzipped CSS, ~3s

### `backend/` — Laravel 9 + PHP 8.2 (fork-and-trim of upstream)

- **936 PHP files** copied + trimmed from upstream `v1.11.3`.
- **All 193 migrations** — schema frozen, zero changes.
- **All 32 models**, all services, all repositories (including `Wings/`),
  all transformers, all events, all observers, all notifications, all jobs.
- **Routes**: `api-client.php` (rewritten for the new contract),
  `api-application.php` + `api-remote.php` + `admin.php` (verbatim),
  `base.php` + `web.php` (minimal). `auth.php` removed.
- **Config**: `cors.php`, `sanctum.php`, `session.php` adjusted for
  cross-origin SPA. Others verbatim.
- **Admin Blade area** kept verbatim — see `docs/11-AdminAreaStrategy.md`.
- **Dockerfile** (PHP 8.2 FPM alpine) + **docker-entrypoint.sh** (runs
  migrations + caches config/routes/views on container start).
- **6 documented deviations** from upstream (auth response shape, server
  list path, 2FA endpoint path, api_key binding, Authenticate middleware
  redirect target, web.php named-route shims) — see `backend/README.md`.

### `shared/` — TypeScript types + Zod schemas

- `types/api.ts` — JSON:API envelope (`JsonApiResource`, `JsonApiList`,
  `JsonApiError`, `JsonApiErrorResponse`, `SignedUrlAttributes`,
  `WebsocketTokenAttributes`, `ServerResourceUsageAttributes`).
- `types/user.ts`, `types/server.ts`, `types/node.ts`, `types/permission.ts`
  (35 permission constants + `hasPermission`/`hasAnyPermission` helpers).
- `schemas/user.ts`, `schemas/server.ts` — Zod schemas for runtime
  validation of API responses.

### `scripts/`

- `dev.sh` — convenience wrapper (install/dev:frontend/dev:backend/
  dev:wings/build/typecheck/lint/db:*).
- `nginx-dev.conf` — dev nginx config for the backend.
- `wings-stub.mjs` — minimal Wings stub (HTTP + WebSocket) for local
  console testing without a real daemon.

### Top-level deployment artifacts

- `vercel.json` — Vite framework, `frontend/dist` output, SPA rewrites,
  asset cache headers, index.html no-cache.
- `docker-compose.yml` — MySQL + Redis + backend + nginx for local dev.
- `frontend/Dockerfile` + `frontend/nginx.conf` — for non-Vercel deployments.
- `backend/.env.example` + `frontend/.env.example` — full env templates.
- `README.md` — top-level project map.

## What's NOT done (explicit)

See `docs/08-RiskRegister.md` §6 and `docs/11-AdminAreaStrategy.md`:

1. **Admin area rebuild in React** — admin stays Blade (Phase 4, ~2-3 weeks).
2. **Wiring every server-scoped React page to live data** — files, backups,
   schedules, users, databases, network, startup, settings, activity show
   placeholders (Phase 3, ~1 week). Backend endpoints already exist.
3. **Running the backend against live MySQL/Redis/Wings in this sandbox**
   — no PHP runtime here. Docker artifacts provided for the user to run.
4. **End-to-end Playwright tests** (Phase 5).
5. **CI/CD pipeline definitions** (Phase 5).

## How to use this

### Local dev

```bash
cd /home/z/my-project
./scripts/dev.sh install          # install frontend deps
./scripts/dev.sh dev:backend      # docker compose up MySQL+Redis, php artisan serve
./scripts/dev.sh dev:frontend     # Vite dev server on :5173
./scripts/dev.sh dev:wings        # Wings stub on :8080 (for console testing)
```

Open http://localhost:5173 → log in → server list → click a server → console.

### Production deploy

See `docs/09-DeploymentGuide.md`:
- Backend: Linux server with PHP 8.2 FPM + Nginx + MySQL + Redis + Supervisor.
- Frontend: Vercel project pointing at this repo, env vars per
  `frontend/.env.example`, `vercel.json` configures the build.
- Wings: unchanged — just update `panel_url` in each node's `config.yml`.

## File counts

```
docs/          11 files  (analysis + strategy + deployment)
frontend/      32 TS/TSX files  (scaffold + auth + dashboard + console)
backend/      936 PHP files     (fork-and-trim of upstream)
shared/         9 TS files      (types + schemas)
scripts/        3 files         (dev.sh, nginx-dev.conf, wings-stub.mjs)
worklog.md   2120 lines         (full multi-agent audit trail)
```
