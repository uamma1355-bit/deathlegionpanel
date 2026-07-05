#!/usr/bin/env bash
# =============================================================================
# Create an admin account on an existing Pterodactyl backend.
#
# Usage:
#   sudo bash scripts/create-admin.sh
#
# Or non-interactively:
#   sudo bash scripts/create-admin.sh \
#     --email admin@yourdomain.com \
#     --username admin \
#     --password 'SecretPass123!' \
#     --first Admin --last User
# =============================================================================

set -euo pipefail

# Defaults
ADMIN_EMAIL=""
ADMIN_USERNAME=""
ADMIN_PASSWORD=""
ADMIN_FIRST=""
ADMIN_LAST=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --email)    ADMIN_EMAIL="$2"; shift 2 ;;
    --username) ADMIN_USERNAME="$2"; shift 2 ;;
    --password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --first)    ADMIN_FIRST="$2"; shift 2 ;;
    --last)     ADMIN_LAST="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Fill interactively for missing
[ -z "$ADMIN_EMAIL" ]    && read -rp "Admin email: " ADMIN_EMAIL
[ -z "$ADMIN_USERNAME" ] && read -rp "Admin username: " ADMIN_USERNAME
[ -z "$ADMIN_FIRST" ]    && read -rp "Admin first name [Admin]: " ADMIN_FIRST && ADMIN_FIRST="${ADMIN_FIRST:-Admin}"
[ -z "$ADMIN_LAST" ]     && read -rp "Admin last name [User]: " ADMIN_LAST && ADMIN_LAST="${ADMIN_LAST:-User}"
[ -z "$ADMIN_PASSWORD" ] && read -rp "Admin password: " -s ADMIN_PASSWORD && echo

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "ERROR: email, username, and password are required."
  exit 1
fi

INSTALL_DIR="${INSTALL_DIR:-/var/www/pterodactyl}"

if [ ! -d "$INSTALL_DIR" ]; then
  echo "ERROR: $INSTALL_DIR does not exist. Run scripts/deploy-backend.sh first."
  exit 1
fi

echo "Creating admin user at $INSTALL_DIR..."
cd "$INSTALL_DIR"
sudo -u www-data php artisan p:user:make \
  --email "$ADMIN_EMAIL" \
  --username "$ADMIN_USERNAME" \
  --name-first "$ADMIN_FIRST" \
  --name-last "$ADMIN_LAST" \
  --password "$ADMIN_PASSWORD" \
  --admin 1

echo ""
echo "✓ Admin created."
echo "  Email:    $ADMIN_EMAIL"
echo "  Username: $ADMIN_USERNAME"
echo ""
echo "  Log in at: https://deathlegionpanel.vercel.app"
echo "  Or admin Blade: https://<your-api-domain>/admin"
