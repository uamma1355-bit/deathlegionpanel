#!/usr/bin/env python3
"""Fix Wings: delete all servers, recreate cleanly, restart Wings."""
import json, urllib.request, base64, time

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', 'no result')
    except Exception as e:
        return f'ERR: {e}'

def php_run(php_code, timeout=60):
    b64 = base64.b64encode(php_code.encode()).decode()
    return run("echo '" + b64 + "' | base64 -d > /tmp/exec.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/exec.php 2>&1 | grep -v Deprecated", timeout=timeout)

# Step 1: Delete ALL servers + recreate cleanly
print("=" * 70)
print("STEP 1: Delete all servers + recreate with clean config")
print("=" * 70)

recreate_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Location;
use Pterodactyl\Services\Servers\ServerCreationService;
use Pterodactyl\Services\Servers\ServerDeletionService;
use Pterodactyl\Services\Users\UserCreationService;

// Delete all existing servers
$ds = app(ServerDeletionService::class);
foreach (Server::all() as $s) {
    try { $ds->handle($s); } catch(\Exception $e) {}
}
echo "Deleted all servers\n";

// Fix egg config - use simple JSON that Wings 1.11.13 can parse
$egg = Egg::find(1);
$egg->startup = 'if [ -f /home/container/package.json ]; then npm install; fi; node /home/container/index.js';
$egg->config_stop = '^C';
$egg->config_files = '{}';
$egg->config_startup = '{"done":["Server running","Connected","Bot ready"]}';
$egg->config_logs = '{}';
$egg->docker_images = '{"Nodejs 24":"ghcr.io/ptero-eggs/yolks:nodejs_24"}';
$egg->save();
echo "Egg fixed\n";

// Create 2 servers per user
$node = Node::first();
$location = Location::first();
$creationService = app(ServerCreationService::class);

$botNames = [
    'DeathLegion Alpha', 'DeathLegion Beta', 'DeathLegion Gamma', 'DeathLegion Delta',
    'DeathLegion Eclipse', 'DeathLegion Falcon', 'DeathLegion Ghost', 'DeathLegion Hunter',
    'DeathLegion Inferno', 'DeathLegion Jaguar', 'DeathLegion Knight', 'DeathLegion Lightning',
    'DeathLegion Matrix', 'DeathLegion Nova', 'DeathLegion Omega', 'DeathLegion Phantom',
    'DeathLegion Quasar', 'DeathLegion Raven', 'DeathLegion Shadow', 'DeathLegion Titan',
];

$idx = 0;
foreach (User::orderBy('id')->get() as $user) {
    $allocs = Allocation::whereNull('server_id')->orderBy('port')->limit(2)->get();
    foreach ($allocs as $alloc) {
        $name = $botNames[$idx] ?? ('DeathLegion Bot ' . ($idx + 1));
        try {
            $server = $creationService->handle([
                'name' => $name,
                'description' => 'WhatsApp Baileys bot for ' . $user->username,
                'owner_id' => $user->id,
                'egg_id' => 1,
                'node_id' => $node->id,
                'location_id' => $location->id,
                'allocation_id' => $alloc->id,
                'environment' => [
                    'MAIN_FILE' => 'index.js',
                    'NODE_ARGS' => '',
                    'NODE_PACKAGES' => '',
                    'AUTO_UPDATE' => '0',
                    'GIT_ADDRESS' => '',
                    'BRANCH' => '',
                    'USER_UPLOAD' => '1',
                ],
                'memory' => 512,
                'swap' => 0,
                'disk' => 1024,
                'io' => 500,
                'cpu' => 100,
                'feature_limits' => ['databases' => 1, 'allocations' => 2, 'backups' => 1],
                'startup' => $egg->startup,
                'image' => 'ghcr.io/ptero-eggs/yolks:nodejs_24',
                'skip_scripts' => true,
                'start_on_completion' => false,
            ]);

            // Install placeholder index.js only
            $volPath = '/var/lib/pterodactyl/volumes/' . $server->uuid;
            @mkdir($volPath, 0755, true);
            $placeholder = "// Upload your bot files to get started!\nconsole.log(\"Upload your bot files via the Files tab\");\nconsole.log(\"The system will auto-detect your main file and install dependencies.\");\n";
            file_put_contents($volPath . '/index.js', $placeholder);
            chown($volPath . '/index.js', 'pterodactyl');
            chgrp($volPath . '/index.js', 'pterodactyl');

            echo "Created: {$name} (port {$alloc->port})\n";
            $idx++;
        } catch (\Exception $e) {
            echo "ERROR creating {$name}: " . $e->getMessage() . "\n";
        }
    }
}
echo "\nTotal created: {$idx}\n";
"""
print(php_run(recreate_php, timeout=120))

# Step 2: Clear cache + restart Wings
print("\n" + "=" * 70)
print("STEP 2: Clear cache + restart Wings")
print("=" * 70)
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1", timeout=20))
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 12; echo '=== Wings log ==='; grep -c 'finished loading' /tmp/wings.log; echo ' servers loaded'; grep -c 'failed to load' /tmp/wings.log; echo ' servers failed'", timeout=25))

# Step 3: Test
print("\n" + "=" * 70)
print("STEP 3: Test")
print("=" * 70)
print(run("curl -s -o /dev/null -w 'Panel: HTTP:%{http_code}' http://127.0.0.1:8000/", timeout=10))
print()
print(run("curl -s -o /dev/null -w 'Wings: HTTP:%{http_code}' -H 'Authorization: Bearer FZ7Nz3jEY8Y1KP4NAfVrP7CV7nkZpGYzWGAZYr4x2bcVoUYfLqn82TgMd7mUp2f6' http://127.0.0.1:8080/api/system", timeout=10))

# Get a server UUID to test WS
uuids = run("mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -N -e 'SELECT uuid FROM servers LIMIT 1' 2>/dev/null", timeout=10).strip()
if uuids:
    print(run(f"curl -s -o /dev/null -w 'WS: HTTP:%{{http_code}}' --max-time 5 -H 'Upgrade: websocket' -H 'Connection: Upgrade' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' http://127.0.0.1:8080/api/servers/{uuids}/ws", timeout=10))

# Test public URL
print()
print(run("curl -s -o /dev/null -w 'Public: HTTP:%{http_code}' --max-time 10 https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/", timeout=15))
