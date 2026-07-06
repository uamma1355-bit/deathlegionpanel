#!/usr/bin/env python3
"""Test the user from API key auth."""
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

use Pterodactyl\\Models\\User;

$u = User::find(1);
echo "User: id={$u->id}, username={$u->username}, root_admin={$u->root_admin}\n";
echo "Server owner_id matches: " . ($u->id === 1 ? "yes" : "no") . "\n";
'''

b64 = base64.b64encode(SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /home/daytona/backend/testuser.php && cd /home/daytona/backend && php testuser.php 2>&1; rm testuser.php",
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
