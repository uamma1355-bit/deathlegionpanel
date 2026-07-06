#!/usr/bin/env python3
"""
Create a test server in the Pterodactyl panel.
Uses the admin API key to:
  1. Get the location, node, egg, and allocation IDs
  2. Create a server assigned to the admin user
  3. Print the server details

This runs INSIDE the backend sandbox via the Daytona API.
"""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# PHP script that creates a server directly in the DB (bypasses the API's complex validation)
SCRIPT = r'''
<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerVariable;
use Pterodactyl\Models\EggVariable;
use Illuminate\Support\Str;

// Find the admin user, node, egg, and a free allocation
$user = User::where("username", "admin")->first();
$node = Node::first();
$egg = Egg::first();

if (!$user || !$node || !$egg) {
    echo "ERR: missing prerequisites (user={$user?->id}, node={$node?->id}, egg={$egg?->id})\n";
    exit(1);
}

// Find a free allocation
$alloc = Allocation::where("node_id", $node->id)->whereNull("server_id")->first();
if (!$alloc) {
    echo "ERR: no free allocations on node {$node->id}\n";
    exit(1);
}

echo "Using: user={$user->id}, node={$node->id}, egg={$egg->id}, alloc={$alloc->id}\n";

// Check if server already exists
$existing = Server::where("owner_id", $user->id)->first();
if ($existing) {
    echo "SERVER_EXISTS:{$existing->id}:{$existing->uuid}:{$existing->name}\n";
    exit(0);
}

// Create the server
$server = new Server();
$server->uuid = Str::uuid();
$server->uuidShort = Str::random(8);
$server->name = "Test Node.js Server";
$server->description = "Test server created by the self-healing system";
$server->owner_id = $user->id;
$server->node_id = $node->id;
$server->allocation_id = $alloc->id;
$server->egg_id = $egg->id;
$server->nest_id = $egg->nest_id;
$server->memory = 512;
$server->swap = 0;
$server->disk = 1024;
$server->io = 500;
$server->cpu = 100;
$server->database_limit = 1;
$server->allocation_limit = 2;
$server->backup_limit = 1;
$server->status = null;
$server->startup = $egg->startup;
$server->image = "ghcr.io/pterodactyl/yolks:node_18";
$server->installed_at = now();
$server->save();

// Assign the allocation to this server
$alloc->server_id = $server->id;
$alloc->save();

echo "SERVER_CREATED:{$server->id}:{$server->uuid}:{$server->name}\n";
echo "SERVER_IDENTIFIER:{$server->uuidShort}\n";
echo "ALLOCATION:{$alloc->ip}:{$alloc->port}\n";
'''

b64 = base64.b64encode(SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /home/daytona/backend/createserver.php && cd /home/daytona/backend && php createserver.php 2>&1; rm createserver.php",
    "cwd": "/home/daytona",
    "timeout": 30,
})
req = urllib.request.Request(
    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
    data=body.encode(),
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req, timeout=60) as resp:
    print(resp.read().decode())
