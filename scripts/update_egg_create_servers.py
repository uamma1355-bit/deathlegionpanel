#!/usr/bin/env python3
"""Update egg to official Node.js config + create 2 servers per user (20 total)."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
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

# Step 1: Update egg #1 (Node.js Generic) to match official config
print("=" * 70)
print("STEP 1: Update Node.js egg to match official eggs.pterodactyl.io config")
print("=" * 70)

# Use a PHP script to update the egg properly
update_egg_php = r"""cat > /tmp/update_egg.php << 'PHPEOF'
<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\Egg;
use Pterodactyl\Models\EggVariable;

// Get egg #1 (Node.js Generic)
$egg = Egg::find(1);
if (!$egg) {
    echo "ERROR: Egg #1 not found\n";
    exit(1);
}

echo "Before: {$egg->name}\n";
echo "  startup: " . substr($egg->startup, 0, 80) . "...\n";
echo "  config_startup: {$egg->config_startup}\n";
echo "  docker_images: " . json_encode($egg->docker_images) . "\n";

// Update to match official config
$egg->name = 'node.js generic';
$egg->description = 'A generic node.js egg. Runs index.js with Node.js 20.';
$egg->startup = 'if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/node /home/container/index.js ${NODE_ARGS}';
$egg->docker_images = [
    'Nodejs 20' => 'ghcr.io/pterodactyl/yolks:nodejs_20',
    'Nodejs 18' => 'ghcr.io/pterodactyl/yolks:nodejs_18',
];

// Config: done markers that match our index.js output
$egg->config_files = '{}';
$egg->config_startup = json_encode([
    'done' => [
        'Server running',
        'Server started',
        'Listening on',
        'Change this text',
    ],
]);
$egg->config_logs = '{}';
$egg->config_stop = '^C';

// Installation script: minimal (just install npm deps if package.json exists)
$egg->script_install = '#!/bin/bash\ncd /mnt/server\nif [ -f package.json ]; then npm install --production; fi\necho "Install complete"\nexit 0';
$egg->script_container = 'ghcr.io/pterodactyl/yolks:nodejs_20';
$egg->script_entry = 'bash';

$egg->save();

echo "\nAfter: {$egg->name}\n";
echo "  startup: " . substr($egg->startup, 0, 80) . "...\n";
echo "  config_startup: {$egg->config_startup}\n";
echo "  docker_images: " . json_encode($egg->docker_images) . "\n";

// Update variables for this egg
$variables = [
    ['env' => 'MAIN_FILE', 'name' => 'Main file', 'default' => 'index.js', 'rules' => 'required|string'],
    ['env' => 'NODE_ARGS', 'name' => 'Additional Arguments', 'default' => '', 'rules' => 'nullable|string'],
    ['env' => 'NODE_PACKAGES', 'name' => 'Additional Node packages', 'default' => '', 'rules' => 'nullable|string'],
    ['env' => 'AUTO_UPDATE', 'name' => 'Auto Update', 'default' => '0', 'rules' => 'required|boolean'],
    ['env' => 'GIT_ADDRESS', 'name' => 'Git Repo Address', 'default' => '', 'rules' => 'nullable|string'],
    ['env' => 'BRANCH', 'name' => 'Install Branch', 'default' => '', 'rules' => 'nullable|string'],
    ['env' => 'USER_UPLOAD', 'name' => 'User Uploaded Files', 'default' => '1', 'rules' => 'required|boolean'],
];

// Delete existing variables
EggVariable::where('egg_id', $egg->id)->delete();

foreach ($variables as $v) {
    EggVariable::create([
        'egg_id' => $egg->id,
        'name' => $v['name'],
        'description' => $v['name'],
        'env_variable' => $v['env'],
        'default_value' => $v['default'],
        'user_viewable' => true,
        'user_editable' => true,
        'rules' => $v['rules'],
        'field_type' => 'text',
    ]);
    echo "  Variable: {$v['env']} = {$v['default']}\n";
}

echo "\nEgg updated successfully!\n";
PHPEOF
cd /home/daytona/pterodactyl-panel && php /tmp/update_egg.php 2>&1 | grep -v "Deprecated"
"""
print(run(update_egg_php, timeout=60))

# Step 2: Get list of users
print("\n" + "=" * 70)
print("STEP 2: Get all users")
print("=" * 70)
get_users_php = r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\User;
foreach (User::all() as $u) {
    echo $u->id . "|" . $u->username . "|" . $u->email . "\n";
}
' 2>&1 | grep -v "Deprecated"
"""
users_out = run(get_users_php, timeout=30)
print(users_out)
users = []
for line in users_out.strip().split('\n'):
    line = line.strip()
    if '|' in line and line[0].isdigit():
        parts = line.split('|')
        if len(parts) >= 3:
            users.append({'id': int(parts[0]), 'username': parts[1], 'email': parts[2]})
print(f"\nFound {len(users)} users")

# Step 3: Create 2 servers per user (delete existing first, then create new)
print("\n" + "=" * 70)
print("STEP 3: Delete existing servers + create 2 per user")
print("=" * 70)

create_servers_php = r"""cat > /tmp/create_servers.php << 'PHPEOF'
<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Services\Servers\ServerCreationService;
use Pterodactyl\Models\Location;

// Delete all existing servers
echo "Deleting existing servers...\n";
foreach (Server::all() as $s) {
    echo "  Deleting: {$s->name}\n";
    $s->delete();
}

$node = Node::first();
$egg = Egg::find(1);
$location = Location::first();

echo "\nNode: {$node->name} ({$node->id})\n";
echo "Egg: {$egg->name} ({$egg->id})\n";
echo "Location: {$location->short} ({$location->id})\n";

// Get available allocations (ports)
$allocations = Allocation::whereNull('server_id')->orderBy('port')->get();
echo "Available allocations: " . count($allocations) . "\n";

$creationService = app(ServerCreationService::class);

$server_configs = [
    ['name_suffix' => 'Web Server', 'desc' => 'Node.js HTTP web server'],
    ['name_suffix' => 'API Server', 'desc' => 'Node.js REST API server'],
];

$port_offset = 0;
$servers_created = 0;

foreach (User::all() as $user) {
    foreach ($server_configs as $config) {
        // Find next available allocation
        $alloc = $allocations->skip($port_offset)->first();
        $port_offset++;
        if (!$alloc) {
            echo "  No more allocations available!\n";
            break 2;
        }

        $server_name = $user->username . "'s " . $config['name_suffix'];

        try {
            $server = $creationService->handle([
                'name' => $server_name,
                'description' => $config['desc'] . ' for ' . $user->username,
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
                'limits' => [
                    'memory' => 512,
                    'swap' => 0,
                    'disk' => 1024,
                    'io' => 500,
                    'cpu' => 100,
                ],
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

            echo "  Created: {$server->name} (UUID: {$server->uuid}, port: {$alloc->port})\n";
            $servers_created++;
        } catch (\Exception $e) {
            echo "  ERROR creating {$server_name}: " . $e->getMessage() . "\n";
        }
    }
}

echo "\nTotal servers created: {$servers_created}\n";
PHPEOF
cd /home/daytona/pterodactyl-panel && php /tmp/create_servers.php 2>&1 | grep -v "Deprecated"
"""
print(run(create_servers_php, timeout=120))

# Step 4: Get all server UUIDs and install files in each
print("\n" + "=" * 70)
print("STEP 4: Install index.js + package.json in each server volume")
print("=" * 70)

get_uuids_php = r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Server;
foreach (Server::all() as $s) {
    echo $s->uuid . "|" . $s->name . "\n";
}
' 2>&1 | grep -v "Deprecated"
"""
uuids_out = run(get_uuids_php, timeout=30)
print(uuids_out)
servers = []
for line in uuids_out.strip().split('\n'):
    line = line.strip()
    if '|' in line and len(line) > 36:
        uuid, name = line.split('|', 1)
        if len(uuid) == 36:
            servers.append({'uuid': uuid, 'name': name})
print(f"\nFound {len(servers)} servers")

# index.js - a proper Node.js HTTP server
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

# package.json
package_json = json.dumps({
    "name": "deathlegion-server",
    "version": "1.0.0",
    "description": "DeathLegion Panel Node.js server",
    "main": "index.js",
    "scripts": {
        "start": "node index.js"
    },
    "dependencies": {}
}, indent=2)

index_b64 = base64.b64encode(index_js.encode()).decode()
pkg_b64 = base64.b64encode(package_json.encode()).decode()

for s in servers:
    uuid = s['uuid']
    name = s['name']
    print(f"  Installing files in {name} ({uuid[:8]}...)")
    result = run(
        "echo '" + index_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/index.js > /dev/null && "
        "echo '" + pkg_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/package.json > /dev/null && "
        "sudo chown -R pterodactyl:pterodactyl /var/lib/pterodactyl/volumes/" + uuid + "/ && "
        "sudo chmod 644 /var/lib/pterodactyl/volumes/" + uuid + "/index.js /var/lib/pterodactyl/volumes/" + uuid + "/package.json && "
        "echo OK"
    )
    print(f"    {result.strip()}")

# Step 5: Clear cache + restart Wings
print("\n" + "=" * 70)
print("STEP 5: Clear cache + restart Wings")
print("=" * 70)
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 10; echo restarted", timeout=30))

# Step 6: Verify
print("\n" + "=" * 70)
print("STEP 6: Verify servers")
print("=" * 70)
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Server;
$servers = Server::all();
echo "Total servers: " . count($servers) . "\n";
foreach ($servers as $s) {
    echo "  #{$s->id}: {$s->name} (owner: {$s->owner_id}, port: " . $s->allocation->port . ")\n";
}
' 2>&1 | grep -v "Deprecated" | head -30""", timeout=30))
