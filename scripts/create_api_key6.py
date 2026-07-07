#!/usr/bin/env python3
"""Create admin API key with encrypt() (not password_hash)."""
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

# Check how the ApiKey model stores/reads the token
check_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\ApiKey;

// Check the ApiKey model for token casting/mutators
$ref = new ReflectionClass(ApiKey::class);
echo "ApiKey casts:\n";
$casts = (new ApiKey())->getCasts();
foreach ($casts as $key => $val) {
    echo "  $key => $val\n";
}

// Check if there's a setTokenAttribute or getTokenAttribute mutator
foreach (['setTokenAttribute', 'getTokenAttribute'] as $method) {
    if ($ref->hasMethod($method)) {
        echo "\n$method exists\n";
    }
}

// Check the auth middleware
echo "\nChecking how auth works...\n";
$key = ApiKey::first();
if ($key) {
    echo "Token type: " . gettype($key->token) . "\n";
    echo "Token (first 40): " . substr($key->token, 0, 40) . "\n";
    // Try to decrypt
    try {
        $dec = decrypt($key->getRawOriginal('token'));
        echo "Decrypt works: YES (len=" . strlen($dec) . ")\n";
    } catch (\Exception $e) {
        echo "Decrypt failed: " . $e->getMessage() . "\n";
    }
}
"""

b64 = base64.b64encode(check_php.encode()).decode()
print("=== Check ApiKey model ===")
print(run("echo '" + b64 + "' | base64 -d > /tmp/check_apikey.php && cd /home/daytona/pterodactyl-panel && php /tmp/check_apikey.php 2>&1 | grep -v Deprecated"))

# Create with encrypt()
create_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;

// Delete old auto-provisioning keys
DB::table('api_keys')->where('memo', 'LIKE', '%Auto-Provisioning%')->delete();

$admin = User::where('root_admin', true)->first();

$identifier = strtoupper(substr(bin2hex(random_bytes(8)), 0, 16));
$plainToken = bin2hex(random_bytes(20));
$encryptedToken = encrypt($plainToken);

DB::table('api_keys')->insert([
    'user_id' => $admin->id,
    'key_type' => 0,
    'identifier' => $identifier,
    'token' => $encryptedToken,
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
print("\n=== Create API key with encrypt() ===")
result = run("echo '" + b64 + "' | base64 -d > /tmp/create_key6.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/create_key6.php 2>&1 | grep -v Deprecated")
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
