#!/usr/bin/env python3
"""Create admin API key with correct permissions (r_* columns)."""
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

# Delete old key and create new one with all r_* permissions set to 1
create_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Pterodactyl\Models\ApiKey;
use Illuminate\Support\Facades\DB;

// Delete old auto-provisioning keys
DB::table('api_keys')->where('memo', 'LIKE', '%Auto-Provisioning%')->delete();

$admin = User::where('root_admin', true)->first();

// Use the ApiKey model properly
$identifier = strtoupper(substr(bin2hex(random_bytes(8)), 0, 16));
$plainToken = bin2hex(random_bytes(20));

// Insert with all permissions set to 1
DB::table('api_keys')->insert([
    'user_id' => $admin->id,
    'key_type' => 0, // TYPE_APPLICATION
    'identifier' => $identifier,
    'token' => password_hash($plainToken, PASSWORD_DEFAULT),
    'memo' => 'DeathLegion Auto-Provisioning',
    'allowed_ips' => null,
    'last_used_at' => null,
    'r_servers' => 1,
    'r_nodes' => 1,
    'r_allocations' => 1,
    'r_users' => 1,
    'r_locations' => 1,
    'r_nests' => 1,
    'r_eggs' => 1,
    'r_database_hosts' => 1,
    'r_server_databases' => 1,
    'created_at' => now(),
    'updated_at' => now(),
]);

echo "Identifier: " . $identifier . "\n";
echo "Token: " . $plainToken . "\n";
echo "Full key: " . $identifier . $plainToken . "\n";
"""

b64 = base64.b64encode(create_php.encode()).decode()
print("=== Create API key with permissions ===")
result = run("echo '" + b64 + "' | base64 -d > /tmp/create_key5.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/create_key5.php 2>&1 | grep -v Deprecated")
print(result)

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
    print(test_result[:300])
    
    # Check error log if it fails
    if 'errors' in test_result:
        print("\n=== Check error log ===")
        print(run('tail -20 /home/daytona/pterodactyl-panel/storage/logs/laravel-2026-07-07.log 2>/dev/null | tail -10'))
