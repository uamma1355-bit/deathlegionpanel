# 02 — Migration Strategy

## 1. Guiding principles

1. **Wings compatibility is sacred.** Any change that risks breaking a running
   Wings daemon is rejected. This includes the JWT signing algorithm, the
   Panel → Wings HTTP surface, and the `/api/remote/*` callback surface.
2. **Database schema is frozen.** No new migrations that alter existing tables.
   New tables/columns are allowed only if they're additive and unused by Wings.
3. **The JSON:API envelope is the contract.** Every client-facing response
   keeps the `{ object, attributes, relationships, meta }` shape produced by
   Spatie Fractal + `JsonApiSerializer`.
4. **Incremental refactor.** Each phase must be independently deployable and
   independently testable. No big-bang cutover.
5. **The original SPA already exists.** Pterodactyl's `resources/scripts/` is
   already a React SPA that talks to `/api/client/*` over Sanctum cookies.
   The decoupling is therefore mostly a **build/deploy** refactor, not a
   rewrite of the user-facing SPA.

## 2. Phase plan

### Phase 1 — Analysis & strategy ✅

- Clone upstream `v1.11.3`.
- Map every route, Blade, React screen, API endpoint, auth/CSRF/session dep,
  Wings surface, WebSocket impl, permission/RBAC, DB schema, jobs, events.
- Produce target architecture, risk register, deployment plan.

### Phase 2 — Scaffold + vertical slice ✅

Delivered in this repo:

- `frontend/` — Vite + React + TS, axios + interceptors, AuthProvider,
  PermissionRoute, ErrorBoundary, WebSocket client, React Router, React Query.
  Implemented screens: Login, LoginCheckpoint (2FA), ForgotPassword,
  ResetPassword, Dashboard (server list + account), ServerConsole.
- `backend/` — Laravel 9 API-only skeleton. Routes registered for
  `/api/client/auth/*`, `/api/client/account`, `/api/client/servers/*`,
  `/api/client/servers/{uuid}/websocket`. CORS + Sanctum configured for
  cross-origin. JSON-only middleware. Exception renderer matching the
  existing error envelope.
- `shared/` — TS types for User, Server, JSON:API envelope, permissions.
- `scripts/` — dev convenience scripts.
- Docker (frontend + backend), docker-compose for local dev with MySQL+Redis,
  Vercel config, env templates, prod + local dev guides.

### Phase 3 — Complete the server-scoped features

Each item below is one PR-sized unit. The frontend already has stubs; the
backend already has the controllers, services, and transformers (reused from
upstream). The work is wiring the React pages to the typed API client.

1. Files (list, read, write, mkdir, rename, copy, delete, compress,
   decompress, chmod, download URL, upload URL).
2. Backups (list, create, delete, download URL, lock).
3. Schedules (list, get, create/update, delete, trigger, tasks CRUD).
4. Databases (list, create, delete, rotate password).
5. Network (list allocations, set notes, set primary, create, delete).
6. Subusers (list, create/update, delete).
7. Startup (read variables, update variable, select docker image).
8. Activity (per-server activity log list).
9. Settings (rename, reinstall).
10. Account (API keys CRUD, SSH keys, 2FA enable/disable, email/password
    update, activity log).

### Phase 4 — Admin area

The admin area is currently 100% Blade + AdminLTE. Rebuilding it in React is
~2-3 person-weeks of work and is **out of scope** for this session. See
[11-AdminAreaStrategy.md](./11-AdminAreaStrategy.md) for the path forward.

In the meantime, the admin area continues to work as a Laravel Blade app
served from the same backend. The decoupled frontend simply links to it
(`/admin/*`) and lets the backend render those pages.

### Phase 5 — Hardening

- Replace Sanctum cookie auth with HttpOnly + SameSite=None + Secure for
  true cross-site Vercel deployments (requires HTTPS on both sides).
- Add a token-refresh flow if bearer mode is used.
- Rate limiting per IP + per user (already exists on `/api/client/*`).
- Audit log of admin actions (already exists via Activity).
- E2E tests (Playwright) for login → server list → console.

## 3. Sequencing rules

- Each phase is deployed behind a feature flag.
- The frontend's `VITE_API_URL` lets us point a single Vercel deployment at
  different backends (preview vs prod).
- The backend serves both the original Blade admin **and** the new JSON APIs.
  This lets us roll the frontend forward without touching the backend.

## 4. Rollback plan

- Frontend: Vercel instant rollback to the previous deployment.
- Backend: standard Laravel deploy + `php artisan migrate:rollback` if a
  migration was part of the deploy (we avoid this — see principle #2).
- Auth: if bearer mode causes issues, flip `VITE_AUTH_MODE=cookie` and the
  frontend falls back to Sanctum SPA cookies.

## 5. What we explicitly do NOT change

- The `users`, `servers`, `nodes`, `eggs`, `allocations`, `subusers`,
  `api_keys`, `sessions`, `backups`, `schedules`, `tasks`, `databases`,
  `database_hosts`, `mounts`, `activity_logs`, `activity_log_subjects`,
  `server_transfers`, `recovery_tokens`, `user_ssh_keys`, `egg_variables`,
  `server_variables` tables. Additive columns only.
- The `Permission` model's 35 string permission constants across 10 categories.
- The `AdminAcl` bitmask (Application API: 9 resources × READ/WRITE).
- The JWT signing algorithm (`NodeJWTService` HMAC-SHA256 keyed by node
  daemon_token).
- The Panel → Wings HTTP endpoints (8 `DaemonRepository` subclasses).
- The Wings → Panel callback endpoints (`routes/api-remote.php`).
- The Fractal + `JsonApiSerializer` response envelope.
- The Sanctum token format (`ptlc_`, `ptla_`).

## 6. Testing strategy

| Layer | Test type | Tool |
|-------|-----------|------|
| Backend unit | Service + repository | PHPUnit (existing Pterodactyl tests) |
| Backend integration | HTTP tests against test DB | PHPUnit + refresh database trait |
| Backend contract | Wings HTTP surface | Mock Wings, assert identical requests |
| Frontend unit | Component + hook | Vitest + React Testing Library |
| Frontend integration | Page + API mock | Vitest + MSW |
| E2E | Full stack | Playwright (Phase 5) |

## 7. Definition of done (per phase)

A phase is done when:
- All TypeScript strict checks pass.
- All ESLint checks pass.
- Frontend `vite build` succeeds.
- Backend `php artisan config:cache && php artisan route:cache` succeeds.
- Manual smoke test of every implemented screen passes against a local
  Docker stack running MySQL + Redis + the backend + Wings stub.
- No regressions in the existing admin Blade area.
