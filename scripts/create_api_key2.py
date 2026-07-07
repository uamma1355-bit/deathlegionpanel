#!/usr/bin/env python3
"""Create admin Application API key with correct identifier length."""
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

# Use the KeyCreationService properly
create_key_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Pterodactyl\Models\ApiKey;
use Pterodactyl\Services\Acl\Api\AdminAcl;

$admin = User::where('root_admin', true)->first();
echo "Admin: {$admin->username} (ID: {$admin->id})\n";

// Generate a proper 16-char identifier
$identifier = substr(str_replace('-', '', \Illuminate\Support\Str::uuid()->toString()), 0, 16);
$token = \Illuminate\Support\Str::random(40);

// Create the key using the model directly with all required fields
$apiKey = new ApiKey();
$apiKey->user_id = $admin->id;
$apiKey->key_type = ApiKey::TYPE_APPLICATION;
$apiKey->identifier = $identifier;
$apiKey->token = password_hash($token, PASSWORD_DEFAULT);
$apiKey->memo = 'DeathLegion Auto-Provisioning';
$apiKey->allowed_ips = null;

// Set permissions - grant all resources read+write
$resources = AdminAcl::getResourceList();
$permissions = [];
foreach ($resources as $resource) {
    $permissions[$resource] = ['r' => true, 'w' => true];
}
$apiKey->permissions = $permissions;
$apiKey->save();

echo "\n=== API Key Created ===\n";
echo "Identifier: {$identifier}\n";
echo "Token (plain): {$token}\n";
echo "Full key: {$identifier}{$token}\n";
echo "Permissions: " . count($permissions) . " resources\n";

// Verify it was saved
$saved = ApiKey::where('identifier', $identifier)->first();
echo "Saved to DB: " . ($saved ? "YES" : "NO") . "\n";
"""

b64 = base64.b64encode(create_key_php.encode()).decode()
print("=== Create admin API key ===")
result = run("echo '" + b64 + "' | base64 -d > /tmp/create_key2.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/create_key2.php 2>&1 | grep -v Deprecated")
print(result)

# Extract the full key
api_key = ''
for line in result.strip().split('\n'):
    if 'Full key:' in line:
        api_key = line.split('Full key:')[1].strip()
        break

print(f"\nFull API Key: {api_key}")

# Test the API key
if api_key:
    print("\n=== Test API key ===")
    print(run(f'curl -s -o /dev/null -w "GET /api/application/users: HTTP:%{{http_code}}\\n" --max-time 10 -H "Authorization: Bearer {api_key}" -H "Accept: application/json" http://127.0.0.1:8000/api/application/users'))
    print(run(f'curl -s --max-time 10 -H "Authorization: Bearer {api_key}" -H "Accept: application/json" http://127.0.0.1:8000/api/application/users | python3 -c "import sys,json;d=json.loads(sys.stdin.read());print(f\'Users visible: {{len(d.get(\\\"data\\\",[]))}}\')"'))
