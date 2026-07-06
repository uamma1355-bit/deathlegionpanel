#!/usr/bin/env python3
"""Create a fresh API key + test all endpoints."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# Delete old API keys + create a fresh one
SCRIPT = '''
<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\ApiKey;
use Pterodactyl\\Models\\User;

$user = User::where("username", "admin")->first();

// Delete all existing client API keys
ApiKey::where("user_id", $user->id)->where("key_type", 1)->delete();

// Create a fresh one
$identifier = ApiKey::generateTokenIdentifier(1);
$plaintext = Illuminate\\Support\\Str::random(ApiKey::KEY_LENGTH);

$key = new ApiKey();
$key->user_id = $user->id;
$key->key_type = 1;
$key->identifier = $identifier;
$key->token = encrypt($plaintext);
$key->memo = "fresh-test-key";
$key->allowed_ips = [];
$key->save();

echo "FRESH_KEY:" . $identifier . $plaintext . "\\n";
'''

b64 = base64.b64encode(SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /home/daytona/backend/freshkey.php && cd /home/daytona/backend && php freshkey.php 2>&1; rm freshkey.php",
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
    result = json.loads(resp.read().decode())
    output = result.get("result", "")
    print(output)
    # Extract the key
    for line in output.split("\n"):
        if line.startswith("FRESH_KEY:"):
            fresh_key = line.replace("FRESH_KEY:", "").strip()
            print(f"\n=== Testing with fresh key: {fresh_key[:20]}... ===")
            
            # Test all endpoints
            endpoints = [
                "/api/client/account",
                "/api/client",
                "/api/client/permissions",
                "/api/client/servers/e3887f0c-15ca-4469-91c7-afa2bc8a25f0",
            ]
            for ep in endpoints:
                body2 = json.dumps({
                    "command": f"curl -s -o /dev/null -w '%{{http_code}}' -H 'Authorization: Bearer {fresh_key}' -H 'Accept: application/json' http://127.0.0.1:8000{ep}; echo",
                    "cwd": "/home/daytona",
                    "timeout": 10,
                })
                req2 = urllib.request.Request(
                    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
                    data=body2.encode(),
                    headers={
                        "Authorization": f"Bearer {TOKEN}",
                        "Content-Type": "application/json",
                    },
                )
                with urllib.request.urlopen(req2, timeout=30) as resp2:
                    r2 = json.loads(resp2.read().decode())
                    code = r2.get("result", "").strip()
                    print(f"  {ep}: HTTP {code}")
            break
