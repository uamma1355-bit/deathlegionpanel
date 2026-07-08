#!/usr/bin/env python3
"""Clean up test users + their servers. Then test apply with completely new user."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Delete test user (ID 14) and their servers (IDs 31, 32) via PHP
print("=== Delete test user + servers ===")
php = b"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Server;
use Pterodactyl\\Models\\User;
use Pterodactyl\\Services\\Servers\\ServerDeletionService;

// Delete servers for user 14
$deletionService = app(ServerDeletionService::class);
$servers = Server::where('owner_id', 14)->get();
foreach ($servers as $s) {
    echo "Deleting server: {$s->name}\\n";
    $deletionService->handle($s);
}

// Delete user 14
$user = User::find(14);
if ($user) {
    $user->delete();
    echo "Deleted user: {$user->username}\\n";
}

// Verify
echo "\\nRemaining users: " . User::count() . "\\n";
echo "Remaining servers: " . Server::count() . "\\n";
"""
b64 = base64.b64encode(php).decode()
print(run(f'echo {b64} | base64 -d > /tmp/cleanup.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/cleanup.php 2>&1 | grep -v Deprecated', timeout=30))

# Step 2: Test apply with a completely new user
print("\n=== Test apply with new user ===")
import subprocess
result = subprocess.run(['curl', '-s', '--max-time', '90', '-X', 'POST', 
    'https://deathlegionpanel.vercel.app/api/apply',
    '-H', 'Content-Type: application/json',
    '-d', '{"first_name":"John","last_name":"Doe","username":"johndoe123","email":"johndoe123@dl.local","password":"JohnDoe123!"}'
], capture_output=True, text=True, timeout=120)
print(result.stdout[:500])

# Step 3: Verify the new user can login
print("\n=== Verify new user login ===")
result2 = subprocess.run(['bash', '-c', '''
VERCEL_URL="https://deathlegionpanel.vercel.app"
rm -f /tmp/vc.txt
curl -s -c /tmp/vc.txt -o /dev/null --max-time 25 "$VERCEL_URL/sanctum/csrf-cookie"
XSRF_RAW=$(grep XSRF-TOKEN /tmp/vc.txt | awk "{print \\$7}")
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")
curl -s -c /tmp/vc.txt -b /tmp/vc.txt --max-time 25 -X POST "$VERCEL_URL/auth/login" \\
  -H "Content-Type: application/json" -H "Accept: application/json" \\
  -H "X-XSRF-TOKEN: $XSRF" -H "X-Requested-With: XMLHttpRequest" \\
  -d '{"user":"johndoe123","password":"JohnDoe123!"}'
'''], capture_output=True, text=True, timeout=60)
print(result2.stdout[:300])

# Step 4: Check allocations available
print("\n=== Available allocations ===")
print(run("mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -e 'SELECT COUNT(*) as available FROM allocations WHERE server_id IS NULL' 2>/dev/null", timeout=10))
