#!/usr/bin/env python3
"""Debug: test the exact query SubstituteClientBindings runs + check user auth."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

SCRIPT = '''
<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Server;
use Pterodactyl\\Models\\ApiKey;
use Pterodactyl\\Models\\User;

// Simulate what SubstituteClientBindings does
$value = "e3887f0c-15ca-4469-91c7-afa2bc8a25f0";
echo "Looking up server with strlen=" . strlen($value) . " (should use uuid column)\\n";
$s = Server::query()->where(strlen($value) === 8 ? "uuidShort" : "uuid", $value)->first();
echo "Result: " . ($s ? "id={$s->id}, name={$s->name}" : "NULL") . "\\n";

// Check the API key
$fullKey = "ptlc_o3cY4ZNQ6wF1nw1orjbZ10rMNzUzN5JXJ7UNnPrg2Ub";
$identifier = substr($fullKey, 0, 16);
$token = substr($fullKey, 16);
echo "\\nAPI key identifier: {$identifier}\\n";
echo "API key token: {$token}\\n";

$key = ApiKey::where("identifier", $identifier)->first();
echo "Key found: " . ($key ? "yes, user_id={$key->user_id}" : "no") . "\\n";
if ($key) {
    $decrypted = decrypt($key->token);
    echo "Decrypted token matches: " . ($decrypted === $token ? "yes" : "no") . "\\n";
    $user = User::find($key->user_id);
    echo "User: id={$user->id}, username={$user->username}, root_admin={$user->root_admin}\\n";
    echo "Server owner_id: {$s->owner_id}\\n";
    echo "User is owner: " . ($user->id === $s->owner_id ? "yes" : "no") . "\\n";
}
'''

b64 = base64.b64encode(SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /home/daytona/backend/debugauth.php && cd /home/daytona/backend && php debugauth.php 2>&1; rm debugauth.php",
    "cwd": "/home/daytona",
    "timeout": 15,
})
req = urllib.request.Request(
    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
    data=body.encode(),
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req, timeout=30) as resp:
    print(resp.read().decode())
