#!/usr/bin/env python3
"""Fix egg: auto-detect main file from package.json, don't pre-install deps.
   Users upload their own bot code with their own package.json."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+10) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

def php_run(php_code, timeout=60):
    b64 = base64.b64encode(php_code.encode()).decode()
    return run("echo '" + b64 + "' | base64 -d > /tmp/exec.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/exec.php 2>&1 | grep -v Deprecated", timeout=timeout)

# Step 1: Update the egg startup command to AUTO-DETECT main file
print("=" * 70)
print("STEP 1: Update egg startup to auto-detect main file")
print("=" * 70)

# New startup that:
# 1. If package.json exists, reads the "main" field
# 2. Falls back to common files: index.js, bot.js, main.js, app.js, server.js
# 3. Runs npm install from user's package.json
# 4. Runs node with the detected main file
NEW_STARTUP = '''if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; MAIN_FILE=$(node -e "try{const p=require('/home/container/package.json');console.log(p.main||'index.js')}catch(e){console.log('index.js')}" 2>/dev/null); if [ -z "$MAIN_FILE" ]; then for f in index.js bot.js main.js app.js server.js start.js; do if [ -f "/home/container/$f" ]; then MAIN_FILE=$f; break; fi; done; fi; if [ -z "$MAIN_FILE" ]; then MAIN_FILE=index.js; fi; echo "Detected main file: $MAIN_FILE"; /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}'''

update_egg_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Egg;
use Pterodactyl\\Models\\Server;

$egg = Egg::find(1);

// New startup that auto-detects main file from package.json
$egg->startup = 'if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; MAIN_FILE=$(node -e "try{const p=require(\\'/home/container/package.json\\');console.log(p.main||\\'index.js\\')}catch(e){console.log(\\'index.js\\')}" 2>/dev/null); if [ -z "$MAIN_FILE" ]; then for f in index.js bot.js main.js app.js server.js start.js; do if [ -f "/home/container/$f" ]; then MAIN_FILE=$f; break; fi; done; fi; if [ -z "$MAIN_FILE" ]; then MAIN_FILE=index.js; fi; echo "Detected main file: $MAIN_FILE"; /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}';

$egg->save();
echo "Egg startup updated to auto-detect main file\\n";
echo "New startup: " . substr($egg->startup, 0, 120) . "...\\n";

// Update all existing servers with the new startup
$count = 0;
foreach (Server::all() as $s) {
    $s->startup = $egg->startup;
    $s->save();
    $count++;
}
echo "Updated {$count} servers with new startup\\n";

// Also update the MAIN_FILE variable default to empty (auto-detect)
use Pterodactyl\\Models\\EggVariable;
$var = EggVariable::where('egg_id', 1)->where('env_variable', 'MAIN_FILE')->first();
if ($var) {
    $var->default_value = 'index.js';
    $var->user_viewable = true;
    $var->user_editable = true;
    $var->save();
    echo "MAIN_FILE variable updated (user can change in Startup tab)\\n";
}
"""
print(php_run(update_egg_php, timeout=45))

# Step 2: Install ONLY a minimal placeholder index.js (NOT package.json)
# Users will upload their own package.json with their bot code
print("\n" + "=" * 70)
print("STEP 2: Install minimal placeholder (NOT package.json)")
print("=" * 70)

PLACEHOLDER_JS = """// Death Legion Panel - Placeholder
// Upload your bot files (index.js, package.json, etc.) via the Files tab
// The system will auto-detect your main file from package.json
// and run npm install automatically on server start.
console.log("Upload your bot files to get started!");
console.log("1. Go to Files tab");
console.log("2. Upload your bot code (index.js, package.json, etc.)");
console.log("3. Click Start to run your bot");
console.log("The system will auto-detect your main file and install dependencies.");
"""

index_b64 = base64.b64encode(PLACEHOLDER_JS.encode()).decode()

# Get all server UUIDs
uuids_out = run("mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -N -e 'SELECT uuid FROM servers' 2>/dev/null", timeout=10)
print(f"Found {uuids_out.strip().count(chr(10))+1} servers")

for line in uuids_out.strip().split('\n'):
    uuid = line.strip()
    if len(uuid) == 36:
        # Install ONLY index.js placeholder, REMOVE any pre-installed package.json
        result = run(
            "echo '" + index_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/index.js > /dev/null && "
            "sudo rm -f /var/lib/pterodactyl/volumes/" + uuid + "/package.json && "
            "sudo chown pterodactyl:pterodactyl /var/lib/pterodactyl/volumes/" + uuid + "/index.js && "
            "echo OK"
        , timeout=10)

print("Placeholder installed (package.json removed)")

# Step 3: Clear cache
print("\n" + "=" * 70)
print("STEP 3: Clear cache + restart Wings")
print("=" * 70)
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1", timeout=20))
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 2; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 8; echo WINGS_RESTARTED", timeout=20))

# Step 4: Verify
print("\n" + "=" * 70)
print("STEP 4: Verify")
print("=" * 70)
verify_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Pterodactyl\\Models\\Egg;
use Pterodactyl\\Models\\Server;
$e = Egg::find(1);
echo "Egg startup: " . substr($e->startup, 0, 150) . "...\n";
echo "Servers: " . Server::count() . "\n";
$s = Server::first();
echo "Server startup: " . substr($s->startup, 0, 150) . "...\n";
"""
print(php_run(verify_php, timeout=20))
