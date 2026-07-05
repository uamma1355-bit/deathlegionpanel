# 10 — Local Development Guide

## 1. Prerequisites

- Docker + Docker Compose (recommended — zero host installs)
- OR: PHP 8.2+, Composer, MySQL 8, Redis 6, Node 20+

## 2. Quick start with Docker Compose

```bash
git clone <your-fork> pterodactyl-decoupled
cd pterodactyl-decoupled

# Copy env templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Boot MySQL + Redis + backend + (optional) Wings stub
docker compose up -d

# Install backend deps + migrate
docker compose exec backend composer install
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate --seed

# Install frontend deps + dev server
cd frontend && npm install && npm run dev
```

Frontend: <http://localhost:5173>
Backend API: <http://localhost:8000/api/client/ping>
Admin (Blade): <http://localhost:8000/admin>

## 3. Without Docker

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# edit .env: DB_* to your MySQL, REDIS_* to your Redis
php artisan migrate --seed
php artisan serve  # http://127.0.0.1:8000
php artisan queue:work  # in another terminal
```

### Frontend

```bash
cd frontend
npm install
npm run dev  # http://127.0.0.1:5173
```

## 4. Default credentials (after `--seed`)

- Email: `admin@pterodactyl.local`
- Password: `Pterodactyl123!`

## 5. Vite dev server + Laravel API on different ports

`frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
VITE_AUTH_MODE=cookie
```

`backend/.env`:
```
SANCTUM_STATEFUL_DOMAINS=localhost:5173,localhost:8000,127.0.0.1:5173,127.0.0.1:8000
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000
SESSION_DOMAIN=localhost
```

## 6. Type checking + lint

```bash
# Frontend
cd frontend
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # vite build

# Backend
cd backend
./vendor/bin/phpstan analyse   # if phpstan configured
./vendor/bin/phpunit           # run tests
```

## 7. Debugging

- Backend: `php artisan telescope` (install separately) or use Laravel Debugbar.
- Frontend: React DevTools + Redux DevTools (if using) + Vite's source maps.
- Network: Chrome DevTools Network tab + cookie viewer extension.

## 8. Working with the `shared/` package

The `shared/` package is consumed by the frontend as a path alias. Vite resolves `@shared/*` to `../shared/*` (see `frontend/vite.config.ts`). No build step for `shared/`.

If you also want to consume it from the backend (e.g. for TS-typed API docs), use `tsc` to emit declaration files. Out of scope for now.

## 9. Adding a new API endpoint

1. Add the route in `backend/routes/api-client.php` (or the appropriate route file).
2. Add the controller method in `backend/app/Http/Controllers/Api/Client/`.
3. Add the transformer method (or new transformer) in `backend/app/Transformers/Api/Client/`.
4. Add the typed call in `frontend/src/api/<domain>/<action>.ts`.
5. Add the React Query hook (or direct call) in the consuming component.
6. Add a Zod schema in `shared/schemas/<domain>.ts` and validate the response.

## 10. Adding a new server-scoped React page

1. Create `frontend/src/pages/server/<Area>Page.tsx`.
2. Add the route to `frontend/src/router.tsx` under the `<ServerLayout>` with the appropriate permission guard.
3. Use `useServerPermissions()` to conditionally render UI.
4. Use React Query for data fetching (cache keys: `['server', uuid, 'area']`).

## 11. Stub Wings for local dev (optional)

If you want to test the full console flow locally without a real Wings daemon, see `scripts/wings-stub.mjs` — a tiny Express server that mimics the Wings HTTP + WS surface. Run it with `node scripts/wings-stub.mjs` and point a node's `daemon_listen` to its port.

## 12. Resetting the dev database

```bash
docker compose exec backend php artisan migrate:fresh --seed
```

## 13. Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `419 CSRF token mismatch` on login | CSRF cookie not set | `GET /sanctum/csrf-cookie` before POST |
| `Network Error` from frontend | CORS misconfigured | Check `CORS_ALLOWED_ORIGINS` includes the Vite origin |
| Console won't connect | Wings unreachable | Verify node `fqdn` + `daemon_listen` are reachable from the browser |
| 2FA login redirects to `/auth/login` repeatedly | Session not persisting cross-origin | Set `SESSION_DOMAIN` correctly, or use token mode |
| File upload returns 401 from Wings | JWT expired | Re-fetch upload URL (15-min TTL) |
