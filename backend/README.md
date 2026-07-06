# Pterodactyl Backend (Decoupled)

API-only Laravel 9 + PHP 8.2 backend. Forked-and-trimmed from
`pterodactyl/panel@v1.11.3` — all services, models, repositories,
transformers, and the Wings communication layer are reused verbatim.

## What's here

- **Routes**: `routes/api-client.php` (rewritten), `api-application.php`,
  `api-remote.php`, `admin.php` (verbatim copies), `base.php` + `web.php`
  (minimal). `auth.php` is removed (auth is now React).
- **App**: all `app/Models/`, `app/Services/`, `app/Repositories/` (incl.
  `Wings/`), `app/Transformers/`, `app/Events/`, `app/Observers/`,
  `app/Notifications/`, `app/Jobs/` copied verbatim.
- **Controllers**: `app/Http/Controllers/Api/Client/`,
  `Api/Application/`, `Api/Remote/` copied verbatim. `Admin/` copied for
  the Blade admin area (kept for now — see
  `docs/11-AdminAreaStrategy.md`).
- **Migrations**: all 193 from upstream — schema is frozen, zero changes.
- **Config**: `cors.php`, `sanctum.php`, `session.php` adjusted for
  cross-origin SPA. Others verbatim.
- **Middleware**: all upstream middleware copied. New `Authenticate`
  middleware redirects unauthenticated users to `FRONTEND_URL` (the React
  SPA) instead of the removed `/auth/login`.

## What's NOT here (vs. upstream)

- `routes/auth.php` — auth is React now.
- `routes/base.php` non-admin routes — Dashboard, Account pages are React.
- `resources/views/templates/` (React shell) — replaced by Vite-built
  `frontend/`.
- `resources/views/layouts/auth.blade.php`, `partials/*` — Blade auth UI
  removed.

## Setup

```bash
cp .env.example .env
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --seed
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan serve  # http://127.0.0.1:8000
```

For Docker, see `../docker-compose.yml` and `Dockerfile`.

## Deviations from upstream

(See `agent-ctx/7-backend-scaffold.md` for the full audit trail.)

1. **Auth response shape**: Upstream `Auth\LoginController::login` returns
   `{ data: { complete, confirmation_token?, intended?, user? } }` (HTTP
   200), not the JSON:API error envelope. The React frontend's
   `src/api/auth/index.ts` handles both shapes.
2. **`/api/client/servers`** vs `GET /api/client`: upstream uses
   `GET /api/client` (`ClientController::index`) for the server list, not
   `/api/client/servers`. The frontend's `getServers()` calls
   `/api/client/servers` — adjust if you're using upstream verbatim.
3. **2FA endpoint paths**: upstream uses `/two-factor`, not `/2fa`.
4. **`{api_key}` binding**: registered per the new contract but the
   existing route uses a plain string param for upstream compat.
5. **`Authenticate` middleware**: rewrote to redirect to `FRONTEND_URL`
   for admin Blade auth redirects.
6. **`routes/web.php`**: added `auth.login` / `auth.logout` named-route
   shims so the admin Blade layout (which references `route('auth.login')`)
   keeps rendering.

## Reference

- `docs/03-SourceAnalysis-Models.md` — models, services, Wings, JWT, schema.
- `docs/04-SourceAnalysis-Routes.md` — routes, middleware, auth, CSRF.
- `docs/06-APIContract.md` — the REST/WebSocket contract.
- `docs/07-WingsCompatibility.md` — what must stay byte-identical.
- `docs/09-DeploymentGuide.md` — production deployment.
- `docs/10-LocalDevGuide.md` — local dev.
