#!/usr/bin/env python3
"""Debug API key - check why 'This action is unauthorized'."""
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

# Check the API key in DB
debug_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\ApiKey;
use Pterodactyl\Models\User;

// Find the auto-provisioning key
$key = ApiKey::where('memo', 'LIKE', '%Auto-Provisioning%')->first();
if (!$key) {
    echo "No auto-provisioning key found!\n";
    exit;
}

echo "Key ID: {$key->id}\n";
echo "User ID: {$key->user_id}\n";
echo "Key type: {$key->key_type}\n";
echo "Identifier: {$key->identifier}\n";
echo "Memo: {$key->memo}\n";
echo "Allowed IPs: " . json_encode($key->allowed_ips) . "\n";
echo "r_users: {$key->r_users}\n";
echo "r_servers: {$key->r_servers}\n";
echo "r_allocations: {$key->r_allocations}\n";
echo "r_nodes: {$key->r_nodes}\n";

// Check the user
$user = User::find($key->user_id);
echo "\nUser: {$user->username} (root_admin: " . ($user->root_admin ? 'true' : 'false') . ")\n";

// Check if the key type is correct
echo "\nApiKey::TYPE_APPLICATION = " . ApiKey::TYPE_APPLICATION . "\n";
echo "ApiKey::TYPE_ACCOUNT = " . ApiKey::TYPE_ACCOUNT . "\n";

// Try to decrypt the token
try {
    $dec = decrypt($key->getRawOriginal('token'));
    echo "\nToken decrypts OK (len=" . strlen($dec) . ")\n";
} catch (\Exception $e) {
    echo "\nToken decrypt FAILED: " . $e->getMessage() . "\n";
}

// Check the auth middleware
echo "\n=== Testing auth ===\n";
echo "Test: Can we authenticate with identifier 735E96098E5297C3?\n";
$testKey = ApiKey::where('identifier', '735E96098E5297C3')->first();
if ($testKey) {
    echo "Found key: type={$testKey->key_type}, user={$testKey->user_id}\n";
    echo "r_users: {$testKey->r_users}, r_servers: {$testKey->r_servers}\n";
}
"""

b64 = base64.b64encode(debug_php.encode()).decode()
print("=== Debug API key ===")
print(run("echo '" + b64 + "' | base64 -d > /tmp/debug_key.php && cd /home/daytona/pterodactyl-panel && php /tmp/debug_key.php 2>&1 | grep -v Deprecated"))

# Check the error log for the unauthorized error
print("\n=== Check error log ===")
print(run("tail -30 /home/daytona/pterodactyl-panel/storage/logs/laravel-2026-07-07.log 2>/dev/null | grep -i 'unauthorized\|Authorization\|AccessDenied' | tail -5"))
