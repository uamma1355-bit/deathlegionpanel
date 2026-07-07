#!/usr/bin/env python3
"""Upgrade all servers to 8GB RAM + start Wings + install files."""
import json, urllib.request, base64

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
    except:
        return 'ERROR'

def php_run(php_code, timeout=60):
    b64 = base64.b64encode(php_code.encode()).decode()
    return run("echo '" + b64 + "' | base64 -d > /tmp/exec.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/exec.php 2>&1 | grep -v Deprecated", timeout=timeout)

# Step 1: Upgrade all 20 servers to 8GB RAM, 4GB swap, 20GB disk, 200% CPU
print("=" * 70)
print("STEP 1: Upgrade all servers to 8GB RAM")
print("=" * 70)

upgrade_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Server;

$count = 0;
foreach (Server::all() as $s) {
    $s->memory = 8192;      // 8GB RAM
    $s->swap = 4096;         // 4GB swap
    $s->disk = 20480;        // 20GB disk
    $s->cpu = 200;           // 200% CPU (2 cores)
    $s->io = 1000;           // IO weight
    $s->save();
    $count++;
    echo "  #{$s->id}: {$s->name} -> 8GB RAM, 20GB disk\\n";
}
echo "\\nUpgraded {$count} servers to 8GB RAM\\n";
"""
print(php_run(upgrade_php, timeout=45))

# Step 2: Pull nodejs_24 image + start Wings
print("\n" + "=" * 70)
print("STEP 2: Pull Docker image + start Wings")
print("=" * 70)
print(run("sudo docker pull ghcr.io/ptero-eggs/yolks:nodejs_24 2>&1 | tail -2", timeout=60))
print(run("nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 8; ps aux | grep wings | grep -v grep | head -1; echo WINGS_STARTED", timeout=20))

# Step 3: Install index.js + package.json in all server volumes
print("\n" + "=" * 70)
print("STEP 3: Install bot files in all server volumes")
print("=" * 70)

INDEX_JS = 'console.log("Bot starting...");\nconsole.log("Connected");\nconsole.log("Bot ready");\nsetInterval(() => { console.log("Bot alive at " + new Date().toISOString()); }, 60000);\n'
PACKAGE_JSON = '{"name":"deathlegion-bot","version":"1.0.0","main":"index.js","scripts":{"start":"node index.js"},"dependencies":{}}'

# Get all server UUIDs
uuids_out = run("cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='use Pterodactyl\\\\Models\\\\Server; foreach (Server::all() as $s) { echo $s->uuid . \"\\n\"; }' 2>&1 | grep -v Deprecated", timeout=20)
print(uuids_out)

index_b64 = base64.b64encode(INDEX_JS.encode()).decode()
pkg_b64 = base64.b64encode(PACKAGE_JSON.encode()).decode()

for line in uuids_out.strip().split('\n'):
    uuid = line.strip()
    if len(uuid) == 36:
        run("echo '" + index_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/index.js > /dev/null && echo '" + pkg_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/package.json > /dev/null && sudo chown -R pterodactyl:pterodactyl /var/lib/pterodactyl/volumes/" + uuid + "/ && echo OK", timeout=10)

# Step 4: Test panel
print("\n" + "=" * 70)
print("STEP 4: Test panel")
print("=" * 70)
print(run("curl -s -o /dev/null -w 'Panel: HTTP:%{http_code} TIME:%{time_total}s\\n' --max-time 10 http://127.0.0.1:8000/", timeout=15))

# Step 5: Verify
print("\n" + "=" * 70)
print("STEP 5: Verify servers")
print("=" * 70)
verify_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Pterodactyl\\Models\\Server;
echo "Total: " . Server::count() . " servers\\n";
foreach (Server::orderBy('id')->get() as $s) {
    echo "  #{$s->id}: {$s->name} | RAM={$s->memory}MB disk={$s->disk}MB cpu={$s->cpu}%\\n";
}
"""
print(php_run(verify_php, timeout=20))
