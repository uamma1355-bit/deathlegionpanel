#!/usr/bin/env python3
"""Check the Server model's uuidShort column — it might be 'uuid_short' (snake_case) not 'uuidShort'."""
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

// Check the servers table columns
$cols = DB::select("DESCRIBE servers");
echo "SERVERS_COLUMNS:";
foreach ($cols as $c) { echo $c->Field . ","; }
echo "\\n";

// Check if uuidShort or uuid_short exists
use Pterodactyl\\Models\\Server;
$s = Server::first();
if ($s) {
    echo "Server found: id={$s->id}\\n";
    echo "Attributes: " . json_encode($s->getAttributes()) . "\\n";
    echo "uuid: " . $s->uuid . "\\n";
    try { echo "uuidShort: " . $s->uuidShort . "\\n"; } catch (\\Exception $e) { echo "uuidShort error: " . $e->getMessage() . "\\n"; }
    try { echo "uuid_short: " . ($s->uuid_short ?? "null") . "\\n"; } catch (\\Exception $e) { echo "uuid_short error: " . $e->getMessage() . "\\n"; }
}
'''

b64 = base64.b64encode(SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /home/daytona/backend/checkcols.php && cd /home/daytona/backend && php checkcols.php 2>&1; rm checkcols.php",
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
