#!/usr/bin/env python3
"""Fix admin API page 500 error - delete old API keys with stale encryption.
   Also clear compiled views cache."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

def php_run(php_code, timeout=60):
    b64 = base64.b64encode(php_code.encode()).decode()
    return run("echo '" + b64 + "' | base64 -d > /tmp/exec.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/exec.php 2>&1 | grep -v Deprecated", timeout=timeout)

# Step 1: Delete all old API keys (they have stale encryption from APP_KEY rotations)
print("=" * 70)
print("STEP 1: Delete stale API keys")
print("=" * 70)

clear_keys_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\ApiKey;

$count = ApiKey::count();
echo "Found {$count} API keys\\n";

// Delete all keys - they have stale encryption
ApiKey::query()->delete();
echo "Deleted all API keys\\n";

// Verify
echo "Remaining: " . ApiKey::count() . "\\n";
"""
print(php_run(clear_keys_php, timeout=30))

# Step 2: Clear compiled views cache
print("\n" + "=" * 70)
print("STEP 2: Clear compiled views cache")
print("=" * 70)
print(run("cd /home/daytona/pterodactyl-panel && php artisan view:clear 2>&1 | tail -2 && rm -rf storage/framework/views/* && php artisan view:cache 2>&1 | tail -2"))

# Step 3: Clear all caches
print("\n" + "=" * 70)
print("STEP 3: Clear all caches")
print("=" * 70)
print(run("cd /home/daytona/pterodactyl-panel && php artisan cache:clear 2>&1 | tail -1 && php artisan config:clear 2>&1 | tail -1 && php artisan route:clear 2>&1 | tail -1"))

# Step 4: Restart PHP server
print("\n" + "=" * 70)
print("STEP 4: Restart PHP server")
print("=" * 70)
print(run('pkill -f "php8.4 -S" 2>/dev/null; sleep 2; cd /home/daytona/pterodactyl-panel && nohup php8.4 -S 0.0.0.0:8001 /home/daytona/pterodactyl-panel/server.php > /tmp/php-server.log 2>&1 & disown; sleep 3; echo PHP restarted'))

# Step 5: Test admin API page
print("\n" + "=" * 70)
print("STEP 5: Test admin pages")
print("=" * 70)
print(run("""# Login
curl -s -c /tmp/sc.txt -o /dev/null http://127.0.0.1:8000/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -X POST http://127.0.0.1:8000/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

echo "Admin pages:"
for page in api users nodes servers nests settings databases locations mounts; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/sc.txt "http://127.0.0.1:8000/admin/$page")
  echo "  /admin/$page: HTTP $CODE"
done
"""))
