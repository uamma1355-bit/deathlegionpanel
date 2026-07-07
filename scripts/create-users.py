#!/usr/bin/env python3
"""Create all users using raw DB inserts (bypasses model validation)."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

SCRIPT = r'''
<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

$users = [
    ["tharu7862", "tharu7862@deathlegion.local", "7862162130", "Tharu", "User"],
    ["Zeus", "zeus@deathlegion.local", "Zeus", "Zeus", "User"],
    ["cirry-man", "cirryman@deathlegion.local", "LopLopto123", "Cirry", "Man"],
    ["dew", "dew@deathlegion.local", "2011", "Dew", "User"],
    ["podda", "podda@deathlegion.local", "podda1234", "Podda", "User"],
    ["NADUN909", "nadun909@deathlegion.local", "Nadun7777", "Nadun", "User"],
    ["danzo_hutto", "danzo_hutto@deathlegion.local", "Jela_kariyek", "Danzo", "Hutto"],
    ["cryneo", "cryneo@deathlegion.local", "0009fucker", "Cryneo", "User"],
    ["demoxhexa", "demoxhexa@deathlegion.local", "same", "Demox", "Hexa"],
];

$nodeId = 1;
$eggId = 1;
$nestId = 1;

// Ensure enough allocations
$freeCount = DB::table("allocations")->where("node_id", $nodeId)->whereNull("server_id")->count();
if ($freeCount < count($users)) {
    $maxPort = DB::table("allocations")->where("node_id", $nodeId)->max("port");
    $nextPort = max($maxPort + 1, 25570);
    for ($i = 0; $i < count($users) - $freeCount + 5; $i++) {
        DB::table("allocations")->insert([
            "node_id" => $nodeId, "ip" => "0.0.0.0", "port" => $nextPort + $i,
        ]);
    }
    echo "Created " . (count($users) - $freeCount + 5) . " new allocations\n";
}

$freeAllocs = DB::table("allocations")->where("node_id", $nodeId)->whereNull("server_id")->get();
echo "Free allocations: " . $freeAllocs->count() . "\n\n";

$allocIdx = 0;
foreach ($users as $userData) {
    [$username, $email, $password, $firstName, $lastName] = $userData;
    $usernameLower = strtolower($username);
    
    // Check if user exists
    $existing = DB::table("users")->where("email", $email)->first();
    if ($existing) {
        // Update password
        DB::table("users")->where("id", $existing->id)->update([
            "password" => password_hash($password, PASSWORD_DEFAULT),
            "username" => $usernameLower,
            "name_first" => $firstName,
            "name_last" => $lastName,
            "updated_at" => now(),
        ]);
        $userId = $existing->id;
        echo "UPDATED: {$usernameLower} (id={$userId})\n";
    } else {
        // Create user via raw insert
        $userId = DB::table("users")->insertGetId([
            "uuid" => Str::uuid()->toString(),
            "email" => $email,
            "username" => $usernameLower,
            "name_first" => $firstName,
            "name_last" => $lastName,
            "password" => password_hash($password, PASSWORD_DEFAULT),
            "language" => "en",
            "root_admin" => 0,
            "use_totp" => 0,
            "gravatar" => 1,
            "created_at" => now(),
            "updated_at" => now(),
        ]);
        echo "CREATED: {$usernameLower} (id={$userId})\n";
    }
    
    // Check if user has a server
    $existingServer = DB::table("servers")->where("owner_id", $userId)->first();
    if ($existingServer) {
        echo "  SERVER_EXISTS: {$existingServer->name}\n";
        continue;
    }
    
    if ($allocIdx >= count($freeAllocs)) {
        echo "  NO_FREE_ALLOCATION\n";
        continue;
    }
    $alloc = $freeAllocs[$allocIdx];
    $allocIdx++;
    
    // Create server
    $serverUuid = Str::uuid()->toString();
    $serverShort = Str::random(8);
    DB::table("servers")->insert([
        "uuid" => $serverUuid,
        "uuidShort" => $serverShort,
        "name" => $username . "'s Server",
        "description" => "Node.js server for " . $username,
        "owner_id" => $userId,
        "node_id" => $nodeId,
        "allocation_id" => $alloc->id,
        "egg_id" => $eggId,
        "nest_id" => $nestId,
        "memory" => 512, "swap" => 0, "disk" => 1024, "io" => 500, "cpu" => 100,
        "database_limit" => 1, "allocation_limit" => 2, "backup_limit" => 1,
        "startup" => 'if [ -f package.json ]; then npm install && npm start; else node index.js; fi',
        "image" => "ghcr.io/pterodactyl/yolks:node_18",
        "installed_at" => now(),
        "oom_disabled" => 1,
        "skip_scripts" => 0,
        "created_at" => now(),
        "updated_at" => now(),
    ]);
    
    DB::table("allocations")->where("id", $alloc->id)->update(["server_id" => DB::getPdo()->lastInsertId()]);
    
    echo "  SERVER: {$username}'s Server (port={$alloc->port})\n";
}

echo "\n=== Summary ===\n";
echo "Total users: " . DB::table("users")->count() . "\n";
echo "Total servers: " . DB::table("servers")->count() . "\n";
echo "DONE\n";
'''

b64 = base64.b64encode(SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /home/daytona/backend/createusers.php && cd /home/daytona/backend && php createusers.php 2>&1; rm createusers.php",
    "cwd": "/home/daytona",
    "timeout": 60,
})
req = urllib.request.Request(
    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
    data=body.encode(),
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req, timeout=120) as resp:
    print(resp.read().decode())
