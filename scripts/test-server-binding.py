#!/usr/bin/env python3
"""Test the server route binding directly."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

SCRIPT = '''
<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Server;

// Test the query that SubstituteClientBindings would run
$uuid = "e3887f0c-15ca-4469-91c7-afa2bc8a25f0";
$short = "JkIBdjyY";

echo "Looking up by uuid ({$uuid}):\n";
$s1 = Server::query()->where("uuid", $uuid)->first();
echo $s1 ? "FOUND: id={$s1->id}, name={$s1->name}\n" : "NOT FOUND\n";

echo "\nLooking up by uuidShort ({$short}):\n";
$s2 = Server::query()->where("uuidShort", $short)->first();
echo $s2 ? "FOUND: id={$s2->id}, name={$s2->name}\n" : "NOT FOUND\n";

echo "\nAll servers:\n";
foreach (Server::all() as $s) {
    echo "  id={$s->id}, uuid={$s->uuid}, uuidShort={$s->uuidShort}, name={$s->name}, owner_id={$s->owner_id}\n";
}
'''

b64 = base64.b64encode(SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /home/daytona/backend/testserver.php && cd /home/daytona/backend && php testserver.php 2>&1; rm testserver.php",
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
