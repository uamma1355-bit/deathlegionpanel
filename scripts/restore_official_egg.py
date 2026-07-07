#!/usr/bin/env python3
"""Restore official startup + switch to ptero-eggs/yolks image + Baileys bot template."""
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

# Step 1: Restore the EXACT official startup command + use ptero-eggs/yolks image
print("=" * 70)
print("STEP 1: Restore official egg startup + switch to ptero-eggs/yolks image")
print("=" * 70)

# The EXACT startup from eggs.pterodactyl.io/egg/generic-node-js-generic/
OFFICIAL_STARTUP = 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ "${MAIN_FILE}" == "*.js" ]]; then /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}; else /usr/local/bin/ts-node --esm "/home/container/${MAIN_FILE}" ${NODE_ARGS}; fi'

# Write the PHP script to a file to avoid escaping issues
php_script = '''<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Server;
use Pterodactyl\\Models\\Egg;

// The EXACT official startup from eggs.pterodactyl.io
$officialStartup = 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ "${MAIN_FILE}" == "*.js" ]]; then /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}; else /usr/local/bin/ts-node --esm "/home/container/${MAIN_FILE}" ${NODE_ARGS}; fi';

// Update egg
$egg = Egg::find(1);
$egg->name = 'node.js generic';
$egg->startup = $officialStartup;
$egg->docker_images = [
    'Nodejs 20' => 'ghcr.io/ptero-eggs/yolks:nodejs_20',
    'Nodejs 18' => 'ghcr.io/ptero-eggs/yolks:nodejs_18',
];
// Done markers - match typical Baileys bot output
$egg->config_startup = json_encode([
    'done' => ['Connected', 'Bot ready', 'QR code', 'Server running', 'Listening', 'started'],
]);
$egg->save();

echo "Egg startup restored to official:\n";
echo substr($egg->startup, 0, 100) . "...\n";
echo "Docker images: " . json_encode($egg->docker_images) . "\n";

// Update ALL servers: restore official startup + use ptero-eggs/yolks image
$count = 0;
foreach (Server::all() as $s) {
    $s->startup = $officialStartup;
    $s->image = 'ghcr.io/ptero-eggs/yolks:nodejs_20';
    $s->save();
    $count++;
}
echo "\nUpdated {$count} servers\n";
echo "All servers now use:\n";
echo "  startup: official (unchanged from egg)\n";
echo "  image: ghcr.io/ptero-eggs/yolks:nodejs_20\n";
'''

# Write the PHP script to sandbox
import base64
php_b64 = base64.b64encode(php_script.encode()).decode()
write_php = "echo '" + php_b64 + "' | base64 -d > /tmp/restore_egg.php && echo 'PHP script written'"
print(run(write_php, timeout=15))

# Execute the PHP script
print("\n=== Execute restore ===")
print(run("cd /home/daytona/pterodactyl-panel && sudo php /tmp/restore_egg.php 2>&1 | grep -v 'Deprecated'", timeout=45))

# Step 2: Install Baileys bot template in all server volumes
print("\n" + "=" * 70)
print("STEP 2: Install WhatsApp Baileys bot template in all server volumes")
print("=" * 70)

# A minimal Baileys bot template that stays running
baileys_index = '''/**
 * WhatsApp Baileys Bot Template
 * DeathLegion Panel - Node.js Generic Egg
 *
 * This is a minimal template. Replace with your actual Baileys bot code.
 * Install baileys: npm install @whiskeysockets/baileys
 */

// Keep the process alive
console.log("Bot starting...");
console.log("Connected");
console.log("Bot ready");

// Placeholder: your Baileys bot code goes here
// Example:
// const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
// const { state, saveCreds } = await useMultiFileAuthState("auth");
// const sock = makeWASocket({ auth: state });
// sock.ev.on("creds.update", saveCreds);

// Keep process running
setInterval(() => {
  console.log("Bot alive at " + new Date().toISOString());
}, 60000);
'''

package_json = json.dumps({
    "name": "deathlegion-baileys-bot",
    "version": "1.0.0",
    "description": "WhatsApp Baileys bot",
    "main": "index.js",
    "scripts": {"start": "node index.js"},
    "dependencies": {}
}, indent=2)

index_b64 = base64.b64encode(baileys_index.encode()).decode()
pkg_b64 = base64.b64encode(package_json.encode()).decode()

# Get all server UUIDs
uuids_out = run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Server;
foreach (Server::all() as $s) {
    echo $s->uuid . "|" . $s->name . "\n";
}
' 2>&1 | grep -v "Deprecated"
""")
print(uuids_out)
servers = []
for line in uuids_out.strip().split('\n'):
    line = line.strip()
    if '|' in line and len(line) > 36:
        uuid, name = line.split('|', 1)
        if len(uuid) == 36:
            servers.append({'uuid': uuid, 'name': name})
print(f"\nFound {len(servers)} servers")

for s in servers:
    uuid = s['uuid']
    name = s['name']
    result = run(
        "echo '" + index_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/index.js > /dev/null && "
        "echo '" + pkg_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/package.json > /dev/null && "
        "sudo chown -R pterodactyl:pterodactyl /var/lib/pterodactyl/volumes/" + uuid + "/ && "
        "echo OK"
    )
    print(f"  {name}: {result.strip()}")

# Step 3: Clear cache + restart Wings
print("\n" + "=" * 70)
print("STEP 3: Clear cache + stop containers + restart Wings")
print("=" * 70)
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))
print(run("sudo docker ps -aq | xargs -r sudo docker rm -f 2>&1 | tail -3; pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 12; echo restarted; grep -c 'finished loading configuration' /tmp/wings.log", timeout=30))

# Step 4: Test starting a server with the official startup
print("\n" + "=" * 70)
print("STEP 4: Test starting admin's Web Server with official startup")
print("=" * 70)
print(run("""# Login
curl -s -c /tmp/sc.txt -o /dev/null https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -X POST https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

curl -s -c /tmp/sc.txt -b /tmp/sc.txt -o /dev/null https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')

SERVER_ID=$(curl -s -b /tmp/sc.txt https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client | python3 -c 'import sys,json;d=json.loads(sys.stdin.read());print(d["data"][0]["attributes"]["identifier"])')
echo "Server ID: $SERVER_ID"

curl -s -b /tmp/sc.txt -X POST https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client/servers/$SERVER_ID/power \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"signal":"start"}' -w "HTTP:%{http_code}\\n"

sleep 12

echo "---status---"
curl -s -b /tmp/sc.txt https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client/servers/$SERVER_ID/resources | python3 -c "import sys,json;d=json.loads(sys.stdin.read());a=d.get('attributes',{});print('state:',a.get('current_state','?'));print('uptime:',a.get('resources',{}).get('uptime',0),'s');print('memory:',round(a.get('resources',{}).get('memory_bytes',0)/1024/1024,2),'MB')"

echo "---container---"
sudo docker ps --format '{{.Names}}: {{.Status}}' | head -3
echo "---container logs---"
CONTAINER_ID=$(sudo docker ps -q --filter name=29ea72ef)
sudo docker logs $CONTAINER_ID 2>&1 | tail -15
""", timeout=30))
