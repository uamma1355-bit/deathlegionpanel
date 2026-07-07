#!/usr/bin/env python3
"""Add more allocations + create remaining 5 servers."""
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

# Step 1: Add allocations 25580-25600 to the node
print("=== Add allocations 25580-25600 ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Allocation;
$node = Node::first();
echo "Adding allocations 25580-25605 to node {$node->id}...\n";
$added = 0;
for ($port = 25580; $port <= 25605; $port++) {
    $exists = Allocation::where("node_id", $node->id)->where("port", $port)->exists();
    if (!$exists) {
        Allocation::create([
            "node_id" => $node->id,
            "ip" => "0.0.0.0",
            "port" => $port,
            "ip_alias" => null,
            "server_id" => null,
            "notes" => null,
        ]);
        $added++;
    }
}
echo "Added $added allocations\n";
echo "Total allocations: " . Allocation::where("node_id", $node->id)->count() . "\n";
echo "Available: " . Allocation::whereNull("server_id")->count() . "\n";
' 2>&1 | grep -v "Deprecated" | tail -10""", timeout=45))

# Step 2: Create remaining servers for users 8, 9, 10
print("\n=== Create remaining servers (danzo_hutto API, cryneo x2, demoxhexa x2) ===")
create_php = r"""cat > /tmp/create3.php << 'PHPEOF'
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

$node = Node::first();
$egg = Egg::find(1);
$location = Location::first();

// Find users who don't have 2 servers yet
$users = User::all();
$creationService = app(ServerCreationService::class);

foreach ($users as $user) {
    $count = Server::where('owner_id', $user->id)->count();
    $needed = 2 - $count;
    if ($needed <= 0) continue;

    echo "{$user->username} has {$count} servers, creating {$needed} more\n";

    $configs = [
        ['suffix' => 'Web Server', 'desc' => 'Node.js HTTP web server'],
        ['suffix' => 'API Server', 'desc' => 'Node.js REST API server'],
    ];

    for ($i = 0; $i < $needed; $i++) {
        $cfg = $configs[$count + $i] ?? $configs[0];
        $alloc = Allocation::whereNull('server_id')->orderBy('port')->first();
        if (!$alloc) {
            echo "  No more allocations!\n";
            break;
        }

        $name = $user->username . "'s " . $cfg['suffix'];
        try {
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
            echo "  Created: {$server->name} | port: {$alloc->port}\n";

            // Install files in volume
            $uuid = $server->uuid;
            $volPath = "/var/lib/pterodactyl/volumes/{$uuid}";
            @mkdir($volPath, 0755, true);

            $indexJs = <<<'JS'
const http = require("http");
const hostname = "0.0.0.0";
const port = process.env.SERVER_PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Hello from DeathLegion Panel!</h1><p>Node.js server is running.</p>");
  } else if (req.url === "/health") {
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
JS;
            file_put_contents("{$volPath}/index.js", $indexJs);
            file_put_contents("{$volPath}/package.json", json_encode([
                "name" => "deathlegion-server",
                "version" => "1.0.0",
                "main" => "index.js",
                "scripts" => ["start" => "node index.js"],
                "dependencies" => new \stdClass(),
            ], JSON_PRETTY_PRINT));
            chown("{$volPath}/index.js", "pterodactyl");
            chgrp("{$volPath}/index.js", "pterodactyl");
            chown("{$volPath}/package.json", "pterodactyl");
            chgrp("{$volPath}/package.json", "pterodactyl");
            echo "  Files installed in volume\n";
        } catch (\Exception $e) {
            echo "  ERROR: " . $e->getMessage() . "\n";
        }
    }
}

echo "\nTotal servers: " . Server::count() . "\n";
PHPEOF
cd /home/daytona/pterodactyl-panel && sudo php /tmp/create3.php 2>&1 | grep -v "Deprecated"
"""
print(run(create_php, timeout=120))

# Clear cache + restart Wings
print("\n=== Clear cache + restart Wings ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 10; echo restarted", timeout=30))

# Final verify
print("\n=== Final verify: all servers ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
echo "Total servers: " . Server::count() . "\n";
echo "Total users: " . User::count() . "\n";
echo "\nServers per user:\n";
foreach (User::all() as $u) {
    $count = Server::where("owner_id", $u->id)->count();
    echo "  {$u->username}: {$count} server(s)\n";
    foreach (Server::where("owner_id", $u->id)->get() as $s) {
        echo "    #{$s->id}: {$s->name} (port {$s->allocation->port})\n";
    }
}
' 2>&1 | grep -v "Deprecated" | head -40""", timeout=30))

# Test starting one server
print("\n=== Test starting admin's Web Server ===")
print(run("""# Login via public URL
curl -s -c /tmp/sc.txt -o /dev/null https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -X POST https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

# Get fresh CSRF
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -o /dev/null https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')

# Get admin's first server identifier
SERVER_ID=$(curl -s -b /tmp/sc.txt https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client | python3 -c 'import sys,json;d=json.loads(sys.stdin.read());print(d["data"][0]["attributes"]["identifier"])')
echo "Server ID: $SERVER_ID"

# Start it
curl -s -b /tmp/sc.txt -X POST https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client/servers/$SERVER_ID/power \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"signal":"start"}' -w "HTTP:%{http_code}\\n"

sleep 10

# Check status
echo "---status---"
curl -s -b /tmp/sc.txt https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client/servers/$SERVER_ID/resources | python3 -c "import sys,json;d=json.loads(sys.stdin.read());a=d.get('attributes',{});print('state:',a.get('current_state','?'));print('uptime:',a.get('resources',{}).get('uptime',0),'s');print('memory:',round(a.get('resources',{}).get('memory_bytes',0)/1024/1024,2),'MB')"
""", timeout=30))
