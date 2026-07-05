#!/usr/bin/env bash
# =============================================================================
# Backend deployment script for the decoupled Pterodactyl panel.
# Targets a fresh Ubuntu 22.04 / 24.04 server. Run as root (or with sudo).
#
# Usage:
#   sudo bash scripts/deploy-backend.sh
#
# Reference:
#   docs/09-DeploymentGuide.md
#   docs/10-LocalDevGuide.md
#
# What this script does:
#   1. Installs PHP 8.2 + extensions, Composer, MySQL 8, Redis, Nginx, Supervisor, Certbot.
#   2. Copies the backend/ directory to /var/www/pterodactyl.
#   3. Sets ownership + permissions.
#   4. Generates APP_KEY + creates .env from .env.example (interactive prompts for DB + domain).
#   5. Runs migrations + caches config/routes/views.
#   6. Configures Nginx vhost for the API domain.
#   7. Sets up Supervisor for the queue worker + cron for the scheduler.
#   8. Issues a Let's Encrypt cert.
#
# After this completes, your API will be live at https://<your-domain>/api/client/ping
# =============================================================================

set -euo pipefail

# Must be root.
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run with sudo: sudo bash $0"
  exit 1
fi

# Path to the backend source — assumes this script is in <repo>/scripts/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_SRC="$REPO_DIR/backend"

if [ ! -d "$BACKEND_SRC" ]; then
  echo "ERROR: backend/ not found at $BACKEND_SRC"
  exit 1
fi

# Interactive prompts.
read -rp "API domain (e.g. api.yourdomain.com): " API_DOMAIN
read -rp "Frontend domain (e.g. panel.yourdomain.com, or deathlegionpanel.vercel.app): " FRONTEND_DOMAIN
read -rp "MySQL root password (will be set if empty): " -s MYSQL_ROOT_PW; echo
read -rp "MySQL app user password (will be set): " -s MYSQL_APP_PW; echo

# Admin account prompts
read -rp "Admin email (e.g. admin@yourdomain.com): " ADMIN_EMAIL
read -rp "Admin username (e.g. admin): " ADMIN_USERNAME
read -rp "Admin first name (e.g. Admin): " ADMIN_FIRST_NAME
read -rp "Admin last name (e.g. User): " ADMIN_LAST_NAME
read -rp "Admin password (min 8 chars): " -s ADMIN_PASSWORD; echo

if [ -z "$API_DOMAIN" ] || [ -z "$FRONTEND_DOMAIN" ] || [ -z "$MYSQL_ROOT_PW" ] || [ -z "$MYSQL_APP_PW" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "ERROR: all fields are required."
  exit 1
fi

INSTALL_DIR="/var/www/pterodactyl"
DB_NAME="pterodactyl"
DB_USER="pterodactyl"

echo ""
echo "============================================================"
echo "  Step 1/7: Installing system packages"
echo "============================================================"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  software-properties-common \
  curl \
  wget \
  git \
  unzip \
  nginx \
  mysql-server \
  redis-server \
  supervisor \
  certbot \
  python3-certbot-nginx

# PHP 8.2 PPA
add-apt-repository -y ppa:ondrej/php
apt-get update -y
apt-get install -y \
  php8.2-fpm \
  php8.2-mysql \
  php8.2-mbstring \
  php8.2-gd \
  php8.2-bcmath \
  php8.2-xml \
  php8.2-curl \
  php8.2-zip \
  php8.2-intl \
  php8.2-opcache \
  php8.2-redis \
  php8.2-gmp

echo ""
echo "============================================================"
echo "  Step 2/7: Copying backend to $INSTALL_DIR"
echo "============================================================"
mkdir -p "$INSTALL_DIR"
rsync -a --delete --exclude vendor --exclude node_modules "$BACKEND_SRC/" "$INSTALL_DIR/"
cd "$INSTALL_DIR"

echo ""
echo "============================================================"
echo "  Step 3/7: Installing Composer + PHP deps"
echo "============================================================"
if [ ! -f /usr/local/bin/composer ]; then
  curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi
composer install --no-dev --optimize-autoloader --no-interaction

echo ""
echo "============================================================"
echo "  Step 4/7: Configuring MySQL"
echo "============================================================"
# Set root password + create app DB + user.
mysql -u root <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PW}';
FLUSH PRIVILEGES;
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${MYSQL_APP_PW}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo ""
echo "============================================================"
echo "  Step 5/7: Generating .env + APP_KEY"
echo "============================================================"
cp .env.example .env
php artisan key:generate --force

# Patch .env with the values we collected.
sed -i "s|^APP_URL=.*|APP_URL=https://${API_DOMAIN}|" .env
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${FRONTEND_DOMAIN}|" .env
sed -i "s|^DB_DATABASE=.*|DB_DATABASE=${DB_NAME}|" .env
sed -i "s|^DB_USERNAME=.*|DB_USERNAME=${DB_USER}|" .env
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${MYSQL_APP_PW}|" .env
sed -i "s|^REDIS_HOST=.*|REDIS_HOST=127.0.0.1|" .env
sed -i "s|^SANCTUM_STATEFUL_DOMAINS=.*|SANCTUM_STATEFUL_DOMAINS=${FRONTEND_DOMAIN},localhost,localhost:5173,127.0.0.1:5173|" .env
sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://${FRONTEND_DOMAIN},http://localhost:5173|" .env
sed -i "s|^SESSION_DOMAIN=.*|SESSION_DOMAIN=.${API_DOMAIN#*.}|" .env

echo ""
echo "============================================================"
echo "  Step 6/7: Migrating + caching"
echo "============================================================"
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan optimize

# Permissions
chown -R www-data:www-data "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"
chmod -R 775 "$INSTALL_DIR/storage" "$INSTALL_DIR/bootstrap/cache"

echo ""
echo "============================================================"
echo "  Step 7/7: Nginx + Supervisor + cron + TLS"
echo "============================================================"

# Nginx vhost
cat > /etc/nginx/sites-available/pterodactyl <<NGINX
server {
    listen 80;
    server_name ${API_DOMAIN};
    root ${INSTALL_DIR}/public;
    index index.php;

    client_max_body_size 100m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_buffering off;
        fastcgi_request_buffering off;
        fastcgi_read_timeout 120s;
    }

    location ~ /\.ht { deny all; }
    location ~ /\.(?!well-known).* { deny all; }
}
NGINX
ln -sf /etc/nginx/sites-available/pterodactyl /etc/nginx/sites-enabled/pterodactyl
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Supervisor for queue worker
cat > /etc/supervisor/conf.d/pterodactyl-worker.conf <<SUP
[program:pterodactyl-worker]
process_name=%(program_name)s_%(process_num)02d
command=php ${INSTALL_DIR}/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=${INSTALL_DIR}/storage/logs/worker.log
stopwaitsecs=3600
SUP
supervisorctl reread
supervisorctl update
supervisorctl start pterodactyl-worker:*

# Cron for scheduler
(crontab -l 2>/dev/null; echo "* * * * * cd ${INSTALL_DIR} && php artisan schedule:run >> /dev/null 2>&1") | crontab -

# Let's Encrypt
echo ""
echo "Issuing TLS certificate for ${API_DOMAIN}..."
certbot --nginx -d "$API_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo ""
echo "============================================================"
echo "  Creating admin account..."
echo "============================================================"
cd "$INSTALL_DIR"
sudo -u www-data php artisan p:user:make \
  --email "$ADMIN_EMAIL" \
  --username "$ADMIN_USERNAME" \
  --name-first "${ADMIN_FIRST_NAME:-Admin}" \
  --name-last "${ADMIN_LAST_NAME:-User}" \
  --password "$ADMIN_PASSWORD" \
  --admin 1

echo ""
echo "============================================================"
echo "  ✓ BACKEND DEPLOYED + ADMIN CREATED"
echo "============================================================"
echo ""
echo "  API URL:        https://${API_DOMAIN}"
echo "  Health check:   https://${API_DOMAIN}/api/client/ping"
echo "  Admin (Blade):  https://${API_DOMAIN}/admin"
echo ""
echo "  Admin login:    ${ADMIN_EMAIL}"
echo "  Admin username: ${ADMIN_USERNAME}"
echo ""
echo "  Frontend URL:   https://${FRONTEND_DOMAIN}"
echo "                  (or https://deathlegionpanel.vercel.app)"
echo ""
echo "  Next: update VITE_API_URL on Vercel to: https://${API_DOMAIN}"
echo "    bash scripts/update-frontend-env.sh https://${API_DOMAIN} <vercel-token> \"DeathLegion Panel\""
echo ""
echo "  Then log in at https://deathlegionpanel.vercel.app with the admin credentials above."
echo ""
