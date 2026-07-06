# 09 — Deployment Guide

## 1. Production topology

```
┌────────────────────────────┐                ┌────────────────────────────────┐
│  Vercel (frontend)         │                │  Linux server (backend)        │
│  panel.example.com         │                │  api.example.com               │
│                            │   HTTPS / WSS  │                                │
│  Static build (Vite)       │ ─────────────► │  Nginx → PHP-FPM               │
│  + CDN                     │                │  Laravel 9 + Sanctum           │
│                            │                │                                │
│  Env (Vercel project):     │                │  Env (/etc/pterodactyl/.env):  │
│   VITE_API_URL             │                │   APP_KEY                      │
│   VITE_AUTH_MODE=cookie    │                │   APP_URL=https://api.example.com
│   VITE_APP_NAME            │                │   DB_*, REDIS_*                │
│                            │                │   SANCTUM_STATEFUL_DOMAINS=panel.example.com
│                            │                │   CORS_ALLOWED_ORIGINS=https://panel.example.com
│                            │                │   SESSION_DRIVER=redis         │
│                            │                │   SESSION_DOMAIN=.example.com  │
│                            │                │   SESSION_SAMESITE=lax         │
└────────────────────────────┘                │                                │
                                              │  Serves:                       │
                                              │   /api/client/*    (JSON)      │
                                              │   /api/application/* (JSON)    │
                                              │   /api/remote/*    (Wings)     │
                                              │   /admin/*         (Blade)     │
                                              │   /sanctum/csrf-cookie         │
                                              └────────────────────────────────┘
                                                              │
                                                              │ Panel → Wings
                                                              │ Bearer {daemon_token}
                                                              ▼
                                              ┌────────────────────────────────┐
                                              │  Wings (on each node)          │
                                              │  node-1.example.com:8080       │
                                              │  unchanged                     │
                                              └────────────────────────────────┘
```

## 2. Domain strategy

**Recommended:** frontend and API on the same root domain.

| Host | Role | Why |
|------|------|-----|
| `panel.example.com` | Frontend (Vercel) | User-facing SPA |
| `api.example.com` | Backend (Linux) | Laravel + Wings comm |
| `node-N.example.com` | Wings daemons | Unchanged |

With `panel.example.com` and `api.example.com` under `.example.com`, Sanctum's `stateful` mode works as-is (cookies flow between subdomains). Set:
- `SANCTUM_STATEFUL_DOMAINS=panel.example.com`
- `SESSION_DOMAIN=.example.com`
- `CORS_ALLOWED_ORIGINS=https://panel.example.com`

**Alternative (different TLDs):** if Vercel preview URLs or a different domain must be used, set `VITE_AUTH_MODE=token` and have users generate a `ptlc_` API key in their account. Cookie mode won't work cross-TLD without `SameSite=None; Secure`, which complicates the CSRF flow.

## 3. Backend deployment (Linux server)

### 3.1 Requirements

- PHP 8.2+ with extensions: `cli`, `fpm`, `gd`, `mbstring`, `pdo_mysql`, `zip`, `bcmath`, `xml`, `curl`, `gmp`
- Composer 2.x
- MySQL 8.0+ (or MariaDB 10.6+)
- Redis 6+
- Nginx (or Caddy) with HTTPS
- Supervisor (for the queue worker)

### 3.2 Install steps

```bash
# 1. Pull the backend
git clone <your-fork> /var/www/pterodactyl
cd /var/www/pterodactyl/backend

# 2. Install PHP deps
composer install --no-dev --optimize-autoloader

# 3. Configure
cp .env.example .env
php artisan key:generate --force
# edit .env with DB/REDIS/APP_URL/SANCTUM_STATEFUL_DOMAINS/CORS_ALLOWED_ORIGINS/SESSION_*

# 4. Migrate
php artisan migrate --force

# 5. Cache for production
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan optimize

# 6. Set permissions
chown -R www-data:www-data /var/www/pterodactyl/backend/storage /var/www/pterodactyl/backend/bootstrap/cache
chmod -R 755 /var/www/pterodactyl/backend/storage

# 7. Supervisor (queue worker)
# /etc/supervisor/conf.d/pterodactyl-worker.conf
[program:pterodactyl-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/pterodactyl/backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/pterodactyl/backend/storage/logs/worker.log
stopwaitsecs=3600

sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start pterodactyl-worker:*

# 8. Scheduler cron
* * * * * cd /var/www/pterodactyl/backend && php artisan schedule:run >> /dev/null 2>&1
```

### 3.3 Nginx config

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    root /var/www/pterodactyl/backend/public;
    index index.php;

    # Allow large file uploads (server files go through here only for metadata — bytes go direct to Wings)
    client_max_body_size 100m;

    # CORS + Sanctum rely on these
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_buffering off;          # streaming for large file reads
        fastcgi_request_buffering off;
        fastcgi_read_timeout 120s;
    }

    location ~ /\.ht { deny all; }
    location ~ /\.(?!well-known).* { deny all; }
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}
```

### 3.4 Caddy alternative (auto-HTTPS)

```caddy
api.example.com {
    root * /var/www/pterodactyl/backend/public
    php_fastcgi unix//run/php/php8.2-fpm.sock
    file_server
    encode zstd gzip
}
```

## 4. Frontend deployment (Vercel)

### 4.1 Vercel project settings

| Setting | Value |
|--------|-------|
| Framework preset | Vite |
| Build command | `pnpm build` (or `npm run build`) |
| Output directory | `frontend/dist` |
| Install command | `pnpm install --frozen-lockfile` (or `npm ci`) |
| Root directory | `frontend/` |

### 4.2 Environment variables (Vercel project → Settings → Environment Variables)

| Key | Value | Environments |
|-----|-------|--------------|
| `VITE_API_URL` | `https://api.example.com` | Production + Preview |
| `VITE_AUTH_MODE` | `cookie` | Production + Preview |
| `VITE_APP_NAME` | `Pterodactyl` | Production + Preview |
| `VITE_WS_URL` | (leave empty — comes from API) | — |

For preview deployments on `*.vercel.app`, add to backend `.env`:
```
SANCTUM_STATEFUL_DOMAINS=panel.example.com,your-preview.vercel.app
CORS_ALLOWED_ORIGINS=https://panel.example.com,https://your-preview.vercel.app
```

### 4.3 `vercel.json` (in repo root, see `/home/z/my-project/vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm ci",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

## 5. Wings (nodes) — UNCHANGED

Wings configuration is unchanged from upstream. The node's `config.yml` still points at the panel's `/api/remote/*` URL with the same `daemon_token_id` and `daemon_token`.

If you migrate from the upstream panel to the decoupled backend, **only the panel URL changes** in `config.yml` — Wings itself doesn't need to be redeployed.

## 6. Migrating from upstream Pterodactyl to the decoupled backend

1. **Backup** the existing database (`mysqldump pterodactyl > backup.sql`).
2. **Deploy** the decoupled backend on a new host (or in-place — same DB schema).
3. **Point** the existing Wings daemons' `panel_url` to the new backend.
4. **Verify** by listing servers in the Application API — should return the same data.
5. **Deploy** the decoupled frontend on Vercel.
6. **Test** login + console + file manager against one node.
7. **Switch DNS** for `panel.example.com` from the old host to Vercel.
8. **Keep** the old panel online for 24h as rollback, then decommission.

## 7. Environment templates

See `/home/z/my-project/backend/.env.example` and `/home/z/my-project/frontend/.env.example`.

## 8. Health checks

### Backend
- `GET /api/client/ping` → `204` (no auth; just checks Laravel booted + DB connected). *(Note: add this route if not present — we add it in the scaffold.)*
- `GET /api/remote/ping` → `204` (Wings callback; checks `DaemonAuthenticate` middleware.)

### Frontend
- Vercel handles this automatically (build succeeds → healthy).

## 9. Monitoring

- Backend: tail `storage/logs/laravel.log` for `ERROR`/`CRITICAL`. Use Papertrail/Loki/CloudWatch.
- Queue: Supervisor status + `php artisan horizon:status` (if using Horizon).
- Database: standard MySQL slow query log + replication lag if applicable.
- Redis: `redis-cli --latency` + memory usage.
- Frontend: Vercel Web Analytics + Sentry (optional, add `VITE_SENTRY_DSN`).

## 10. Backup strategy

- **Database**: nightly `mysqldump` + continuous binlog replication to a standby.
- **Storage**: `storage/app/` contains user-uploaded egg icons, etc. — back up nightly.
- **Configuration**: `.env`, `config/pterodactyl.php` — store in a secrets manager (Vault, AWS Secrets Manager, Doppler).
- **Backups of game servers**: handled by Wings itself (S3 adapter recommended).
