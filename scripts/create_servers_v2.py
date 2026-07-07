#!/usr/bin/env python3
"""Create 2 servers per user with correct data structure."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=120):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', 'no result')
    except Exception as e:
        return f'ERR: {e}'

# Create servers with correct structure - limits and feature_limits at top level
create_php = r"""cat > /tmp/create2.php << 'PHPEOF'
<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Location;
use Pterodactyl\Services\Servers\ServerCreationService;

// Delete existing servers first
foreach (Server::all() as $s) {
    $s->delete();
}

$node = Node::first();
$egg = Egg::find(1);
$location = Location::first();

// Get all available allocations (unassigned)
$allocations = Allocation::whereNull('server_id')->orderBy('port')->get();
echo "Available allocations: " . count($allocations) . "\n";

$creationService = app(ServerCreationService::class);

$server_configs = [
    ['suffix' => 'Web Server', 'desc' => 'Node.js HTTP web server'],
    ['suffix' => 'API Server', 'desc' => 'Node.js REST API server'],
];

$port_idx = 0;
$created = 0;

foreach (User::all() as $user) {
    foreach ($server_configs as $cfg) {
        $alloc = $allocations->slice($port_idx, 1)->first();
        $port_idx++;
        if (!$alloc) {
            echo "No more allocations!\n";
            break 2;
        }

        $name = $user->username . "'s " . $cfg['suffix'];

        try {
            // Correct structure: limits and feature_limits as top-level keys
            $server = $creationService->handle([
                'name' => $name,
                'description' => $cfg['desc'] . ' for ' . $user->username,
                'owner_id' => $user->id,
                'egg_id' => $egg->id,
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
                'feature_limits' => [
                    'databases' => 1,
                    'allocations' => 2,
                    'backups' => 1,
                ],
                'startup' => 'if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/node /home/container/index.js ${NODE_ARGS}',
                'image' => 'ghcr.io/pterodactyl/yolks:nodejs_20',
                'skip_scripts' => true,
                'start_on_completion' => false,
            ]);

            echo "Created: {$server->name} | UUID: {$server->uuid} | port: {$alloc->port}\n";
            $created++;
        } catch (\Exception $e) {
            echo "ERROR {$name}: " . $e->getMessage() . "\n";
        }
    }
}

echo "\nTotal created: {$created}\n";
PHPEOF
cd /home/daytona/pterodactyl-panel && php /tmp/create2.php 2>&1 | grep -v "Deprecated"
"""
print("=== Create 2 servers per user ===")
print(run(create_php, timeout=120))

# Now install files in each server volume
print("\n=== Get server UUIDs ===")
uuids_out = run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='use Pterodactyl\Models\Server; foreach (Server::all() as $s) { echo $s->uuid . "|" . $s->name . "\n"; }' 2>&1 | grep -v "Deprecated"
""")
print(uuids_out)

servers = []
for line in uuids_out.strip().split('\n'):
    line = line.strip()
    if '|' in line and len(line) > 36:
        uuid, name = line.split('|', 1)
        if len(uuid) == 36:
            servers.append({'uuid': uuid, 'name': name})
print(f"Found {len(servers)} servers")

# index.js - proper Node.js HTTP server
index_js = '''const http = require("http");
const hostname = "0.0.0.0";
const port = process.env.SERVER_PORT || 3000;

const server = http.createServer((req, res) => {
  const url = req.url;
  if (url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Hello from DeathLegion Panel!</h1><p>Node.js server is running.</p>");
  } else if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(port, hostname, () => {
  console.log("Server running at http://" + hostname + ":" + port + "/");
  console.log("Server started successfully");
});
'''

package_json = json.dumps({
    "name": "deathlegion-server",
    "version": "1.0.0",
    "description": "DeathLegion Panel Node.js server",
    "main": "index.js",
    "scripts": {"start": "node index.js"},
    "dependencies": {}
}, indent=2)

index_b64 = base64.b64encode(index_js.encode()).decode()
pkg_b64 = base64.b64encode(package_json.encode()).decode()

print("\n=== Install files in each server volume ===")
for s in servers:
    uuid = s['uuid']
    name = s['name']
    result = run(
        "echo '" + index_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/index.js > /dev/null && "
        "echo '" + pkg_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/package.json > /dev/null && "
        "sudo chown -R pterodactyl:pterodactyl /var/lib/pterodactyl/volumes/" + uuid + "/ && "
        "sudo chmod 644 /var/lib/pterodactyl/volumes/" + uuid + "/index.js /var/lib/pterodactyl/volumes/" + uuid + "/package.json && "
        "echo OK"
    )
    print(f"  {name}: {result.strip()}")

# Clear cache + restart Wings
print("\n=== Clear cache + restart Wings ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 10; echo restarted", timeout=30))

# Verify
print("\n=== Verify ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Server;
echo "Total servers: " . Server::count() . "\n";
foreach (Server::all() as $s) {
    echo "  #{$s->id}: {$s->name} | owner={$s->owner_id} | port=" . $s->allocation->port . " | image={$s->image}\n";
}
' 2>&1 | grep -v "Deprecated" | head -30""", timeout=30))
