#!/usr/bin/env python3
"""Create admin API key via direct DB insert."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+10) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Use raw SQL to create the API key
create_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

$admin = User::where('root_admin', true)->first();

// Generate identifier (16 chars) and token (plain text)
$identifier = strtoupper(substr(bin2hex(random_bytes(8)), 0, 16));
$plainToken = bin2hex(random_bytes(20));
$hashedToken = password_hash($plainToken, PASSWORD_DEFAULT);

// All ACL resources with full permissions
$permissions = json_encode([
    'user' => ['r' => true, 'w' => true],
    'server' => ['r' => true, 'w' => true],
    'node' => ['r' => true, 'w' => true],
    'allocation' => ['r' => true, 'w' => true],
    'nest' => ['r' => true, 'w' => true],
    'egg' => ['r' => true, 'w' => true],
    'database' => ['r' => true, 'w' => true],
    'location' => ['r' => true, 'w' => true],
    'mount' => ['r' => true, 'w' => true],
]);

// Insert directly
DB::table('api_keys')->insert([
    'user_id' => $admin->id,
    'key_type' => 0, // TYPE_APPLICATION
    'identifier' => $identifier,
    'token' => $hashedToken,
    'memo' => 'DeathLegion Auto-Provisioning',
    'allowed_ips' => null,
    'permissions' => $permissions,
    'last_used_at' => null,
    'created_at' => now(),
    'updated_at' => now(),
]);

echo "Identifier: " . $identifier . "\n";
echo "Token: " . $plainToken . "\n";
echo "Full key: " . $identifier . $plainToken . "\n";
"""

b64 = base64.b64encode(create_php.encode()).decode()
print("=== Create admin API key via DB ===")
result = run("echo '" + b64 + "' | base64 -d > /tmp/create_key3.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/create_key3.php 2>&1 | grep -v Deprecated")
print(result)

# Extract the full key
api_key = ''
for line in result.strip().split('\n'):
    if 'Full key:' in line:
        api_key = line.split('Full key:')[1].strip()
        break

print(f"\nFull API Key: {api_key}")

# Test it
if api_key:
    print("\n=== Test API key ===")
    test_result = run(f'curl -s --max-time 10 -H "Authorization: Bearer {api_key}" -H "Accept: application/json" http://127.0.0.1:8000/api/application/users')
    print(test_result[:200])
