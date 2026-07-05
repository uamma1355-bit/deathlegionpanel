#!/usr/bin/env bash
# Backend container entrypoint: runs migrations, caches config/routes/views, then execs the CMD.
# Reference: docs/09-DeploymentGuide.md
set -euo pipefail

cd /var/www/pterodactyl

echo "[entrypoint] generating APP_KEY if missing..."
if [ -z "${APP_KEY:-}" ]; then
  php artisan key:generate --force
fi

echo "[entrypoint] migrating database..."
php artisan migrate --force

echo "[entrypoint] caching config + routes + views..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

echo "[entrypoint] optimizing..."
php artisan optimize

echo "[entrypoint] ensuring storage permissions..."
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

echo "[entrypoint] starting: $@"
exec "$@"
