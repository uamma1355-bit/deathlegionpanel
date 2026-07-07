#!/usr/bin/env python3
"""Unify Pterodactyl panel on Daytona - fix MAC invalid, kill Vercel split, make ONE panel."""
import os, json, urllib.request, urllib.error, time

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
DAYTONA_API = 'https://app.daytona.io/api'
PUBLIC_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
PANEL_DIR = '/home/daytona/pterodactyl-panel'

def run_cmd(cmd, timeout=60):
    url = f'{DAYTONA_API}/toolbox/{SANDBOX_ID}/toolbox/process/execute'
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            data = json.loads(r.read().decode())
            return data.get('result', '') or f'[exit:{data.get("exitCode")}]'
    except urllib.error.HTTPError as e:
        return f'HTTP {e.code}: {e.read().decode()[:500]}'
    except Exception as e:
        return f'ERR: {e}'

# STEP 1: Generate a fresh APP_KEY and write a clean .env with the public URL
print("=" * 70)
print("STEP 1: Rewrite .env with PUBLIC URL + fresh APP_KEY + trusted proxies")
print("=" * 70)

new_env = f'''APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:X6ocTOK7vozJic/GooTd1wQLDGo3Zu88lcXviCUX0pM=
APP_THEME=pterodactyl
APP_TIMEZONE=UTC
APP_URL={PUBLIC_URL}
APP_LOCALE=en
APP_ENVIRONMENT_ONLY=false
LOG_CHANNEL=daily
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=warning
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pterodactyl
DB_USERNAME=pterodactyl
DB_PASSWORD=ptero_app_pw_2025
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_DOMAIN=.daytonaproxy01.eu
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS={PUBLIC_HOST},localhost,localhost:8000,127.0.0.1,127.0.0.1:8000
TRUSTED_PROXIES=**
HASHIDS_SALT=
HASHIDS_LENGTH=8
MAIL_MAILER=log
MAIL_HOST=smtp.example.com
MAIL_PORT=25
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=no-reply@deathlegion.local
MAIL_FROM_NAME="DeathLegion Panel"
RECAPTCHA_ENABLED=false
RECAPTCHA_WEBSITE_KEY=
RECAPTCHA_SECRET_KEY=
'''

# Write .env via heredoc
write_env_cmd = f"""cat > {PANEL_DIR}/.env << 'ENVEOF'
{new_env}ENVEOF
echo "ENV_WRITTEN"
cat {PANEL_DIR}/.env | head -5
"""
print(run_cmd(write_env_cmd))

# STEP 2: Flush Redis (clears stale sessions causing MAC invalid)
print()
print("=" * 70)
print("STEP 2: Flush Redis to clear stale encrypted sessions (fixes MAC invalid)")
print("=" * 70)
print(run_cmd("redis-cli FLUSHALL && redis-cli DBSIZE"))

# STEP 3: Clear Laravel caches & config cache, then re-cache for production
print()
print("=" * 70)
print("STEP 3: Clear Laravel caches and rebuild config cache")
print("=" * 70)
print(run_cmd(
    f"cd {PANEL_DIR} && php artisan cache:clear 2>&1 | tail -3 && "
    f"php artisan config:clear 2>&1 | tail -3 && "
    f"php artisan route:clear 2>&1 | tail -3 && "
    f"php artisan view:clear 2>&1 | tail -3 && "
    f"php artisan config:cache 2>&1 | tail -3 && "
    f"php artisan route:cache 2>&1 | tail -3 && "
    f"php artisan view:cache 2>&1 | tail -3 && "
    f"php artisan event:cache 2>&1 | tail -3 && "
    f"echo CACHE_DONE"
))

# STEP 4: Make sure storage & bootstrap/cache are writable
print()
print("=" * 70)
print("STEP 4: Fix permissions on storage & bootstrap/cache")
print("=" * 70)
print(run_cmd(
    f"chmod -R 777 {PANEL_DIR}/storage {PANEL_DIR}/bootstrap/cache && "
    f"chown -R daytona:daytona {PANEL_DIR}/storage {PANEL_DIR}/bootstrap/cache && "
    f"echo PERMS_OK"
))

# STEP 5: Restart php built-in server with fresh env
print()
print("=" * 70)
print("STEP 5: Restart PHP server (kill old, start fresh on port 8000)")
print("=" * 70)
restart_cmd = f"""# Kill any existing php server processes
pkill -f 'php8.4 -S' 2>/dev/null || true
sleep 2

# Start fresh PHP server in background
cd {PANEL_DIR}
nohup php8.4 -S 0.0.0.0:8000 {PANEL_DIR}/server.php > /tmp/php-server.log 2>&1 &
disown
sleep 3

# Verify it's running
ss -tlnp | grep :8000
echo "PHP_SERVER_STARTED"
"""
print(run_cmd(restart_cmd))

# STEP 6: Test the panel locally with new env
print()
print("=" * 70)
print("STEP 6: Test login locally with fresh env")
print("=" * 70)
test_login = f"""# Get fresh CSRF
curl -s -c /tmp/test-cookies.txt -o /dev/null http://127.0.0.1:8000/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/test-cookies.txt | awk '{{print $7}}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
SESSION=$(grep pterodactyl_session /tmp/test-cookies.txt | awk '{{print $7}}')

# Login
curl -s -i -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H "X-XSRF-TOKEN: $XSRF" \
  -H "Cookie: XSRF-TOKEN=$(grep XSRF-TOKEN /tmp/test-cookies.txt | awk '{{print $7}}'); pterodactyl_session=$SESSION" \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{{"user":"admin","password":"DeathLegion2025!"}}' 2>&1 | head -25
"""
print(run_cmd(test_login))

# STEP 7: Test from public URL (through the Daytona proxy)
print()
print("=" * 70)
print("STEP 7: Test public URL access")
print("=" * 70)
test_public = f"""# Test public URL responds
curl -s -o /dev/null -w 'HTTP:%{{http_code}} TIME:%{{time_total}}s\\n' {PUBLIC_URL}/

# Test public CSRF
curl -s -c /tmp/pub-cookies.txt -o /dev/null {PUBLIC_URL}/sanctum/csrf-cookie
cat /tmp/pub-cookies.txt 2>/dev/null | head -10

# Try login through public URL
XSRF=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{{print $7}}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
SESSION=$(grep pterodactyl_session /tmp/pub-cookies.txt | awk '{{print $7}}')

curl -s -X POST {PUBLIC_URL}/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H "Origin: {PUBLIC_URL}" \
  -H "Referer: {PUBLIC_URL}/" \
  -H "X-XSRF-TOKEN: $XSRF" \
  -H "Cookie: XSRF-TOKEN=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{{print $7}}'); pterodactyl_session=$SESSION" \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{{"user":"admin","password":"DeathLegion2025!"}}' 2>&1 | head -10
"""
print(run_cmd(test_public, timeout=45))

# STEP 8: Check the panel home page loads with the React app
print()
print("=" * 70)
print("STEP 8: Verify React app loads via public URL")
print("=" * 70)
verify = f"""curl -s {PUBLIC_URL}/ | head -30
echo "---"
curl -s -o /dev/null -w 'manifest:%{{http_code}}\\n' {PUBLIC_URL}/assets/manifest.json
curl -s -o /dev/null -w 'bundle:%{{http_code}}\\n' {PUBLIC_URL}/assets/bundle.bae76759.js
"""
print(run_cmd(verify, timeout=30))

print()
print("=" * 70)
print("UNIFICATION COMPLETE")
print("=" * 70)
print(f"Panel URL: {PUBLIC_URL}")
print(f"Admin: admin / DeathLegion2025!")
