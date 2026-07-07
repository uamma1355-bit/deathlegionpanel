#!/usr/bin/env python3
"""Simplify startup command to just 'node index.js' (avoid shell parsing issues)."""
import json, urllib.request

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

# Step 1: Update all servers + egg to use simple 'node index.js' startup
print("=== Update startup to 'node index.js' ===")
print(run(r"""cat > /tmp/fix_startup.php << 'PHPEOF'
<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\Server;
use Pterodactyl\Models\Egg;

// Update egg
$egg = Egg::find(1);
$egg->startup = 'node /home/container/index.js';
$egg->save();

// Update all servers
$count = 0;
foreach (Server::all() as $s) {
    $s->startup = 'node /home/container/index.js';
    $s->save();
    $count++;
}

echo "Updated {$count} servers and egg\n";
echo "Egg startup: " . Egg::find(1)->startup . "\n";
PHPEOF
cd /home/daytona/pterodactyl-panel && sudo php /tmp/fix_startup.php 2>&1 | grep -v "Deprecated"
""", timeout=45))

# Step 2: Clear cache + restart Wings
print("\n=== Clear cache + restart Wings ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))
print(run("sudo docker ps -aq | xargs -r sudo docker rm -f 2>&1 | tail -3; pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 12; echo restarted; grep -c 'finished loading configuration' /tmp/wings.log", timeout=30))

# Step 3: Test starting admin's Web Server
print("\n=== Start admin's Web Server ===")
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
sudo docker ps --format '{{.Names}}: {{.Status}}' | head -5
echo "---container logs---"
sudo docker logs $(sudo docker ps -q --filter name=29ea72ef) 2>&1 | tail -10
""", timeout=30))
