#!/usr/bin/env python3
"""Create admin Application API key for user/server auto-provisioning."""
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

# Create an admin application API key via PHP
create_key_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\ApiKey;
use Pterodactyl\\Models\\User;
use Pterodactyl\\Services\\Acl\\Api\\AdminAcl;

// Find admin user
$admin = User::where('root_admin', true)->first();
echo "Admin user: {$admin->username} (ID: {$admin->id})\\n";

// Create application API key with full permissions
$key = ApiKey::create([
    'user_id' => $admin->id,
    'key_type' => ApiKey::TYPE_APPLICATION,
    'identifier' => 'dl_admin_' . substr(md5(uniqid('', true)), 0, 12),
    'token' => \Illuminate\Support\Str::random(40),
    'memo' => 'DeathLegion Auto-Provisioning Key',
    'allowed_ips' => null,  // allow from any IP (Vercel)
]);

// Grant all ACL permissions
$resources = AdminAcl::getResourceList();
$permissions = [];
foreach ($resources as $resource) {
    $permissions[$resource] = ['r' => true, 'w' => true, 'cr' => true];
}
$key->update(['permissions' => $permissions]);

echo "\\n=== API Key Created ===\\n";
echo "Identifier: {$key->identifier}\\n";
echo "Token: {$key->token}\\n";
echo "Full key: {$key->identifier}{$key->token}\\n";
echo "Memo: {$key->memo}\\n";
echo "Permissions: " . count($permissions) . " resources\\n";
"""

b64 = base64.b64encode(create_key_php.encode()).decode()
print("=== Create admin API key ===")
result = run("echo '" + b64 + "' | base64 -d > /tmp/create_key.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/create_key.php 2>&1 | grep -v Deprecated")
print(result)

# Extract the full key
lines = result.strip().split('\n')
api_key = ''
for line in lines:
    if 'Full key:' in line:
        api_key = line.split('Full key:')[1].strip()
        break

print(f"\nAPI Key: {api_key}")

# Test the API key works
if api_key:
    print("\n=== Test API key ===")
    print(run(f'curl -s -o /dev/null -w "GET /api/application/users: HTTP:%{{http_code}}\\n" --max-time 10 -H "Authorization: Bearer {api_key}" -H "Accept: application/json" http://127.0.0.1:8000/api/application/users'))
    print(run(f'curl -s -o /dev/null -w "GET /api/application/servers: HTTP:%{{http_code}}\\n" --max-time 10 -H "Authorization: Bearer {api_key}" -H "Accept: application/json" http://127.0.0.1:8000/api/application/servers'))
