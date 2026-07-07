#!/usr/bin/env python3
"""Fix Docker image - correct tag is nodejs_20 not node_20."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=180):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+10) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Pull the correct image (nodejs_20)
print("=== Step 1: Pull correct image ghcr.io/pterodactyl/yolks:nodejs_20 ===")
print(run("""echo "Pulling nodejs_20..."
sudo docker pull ghcr.io/pterodactyl/yolks:nodejs_20 2>&1 | tail -5
echo "---available images---"
sudo docker images | grep -i 'pterodactyl/yolks' | head -10
""", timeout=180))

# Step 2: Update all servers to use nodejs_20
print("\n=== Step 2: Update all servers to use nodejs_20 ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Server;
$servers = Server::all();
echo "Updating " . count($servers) . " servers...\n";
foreach ($servers as $s) {
    echo "  Server #{$s->id} ({$s->name}): image was {$s->image}\n";
    $s->image = "ghcr.io/pterodactyl/yolks:nodejs_20";
    $s->save();
}
echo "Done.\n";
' 2>&1 | grep -v Deprecated | head -25""", timeout=45))

# Step 3: Update egg docker_images
print("\n=== Step 3: Update egg docker_images ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Egg;
$eggs = Egg::all();
foreach ($eggs as $egg) {
    $images = $egg->docker_images;
    if (is_array($images)) {
        $new = [];
        foreach ($images as $key => $val) {
            $new["nodejs_20"] = "ghcr.io/pterodactyl/yolks:nodejs_20";
        }
        $egg->docker_images = $new;
        $egg->save();
        echo "Egg #{$egg->id} ({$egg->name}): " . implode(",", array_keys($new)) . "\n";
    }
}
' 2>&1 | grep -v Deprecated | head -10""", timeout=30))

# Step 4: Clear cache
print("\n=== Step 4: Clear cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))

# Step 5: Restart Wings
print("\n=== Step 5: Restart Wings ===")
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 8; ps aux | grep 'wings --config' | grep -v grep | head -1; echo '---log---'; tail -15 /tmp/wings.log", timeout=30))

# Step 6: Try starting a server
print("\n=== Step 6: Try starting a server ===")
print(run("""# Login
curl -s -c /tmp/sc.txt -o /dev/null http://127.0.0.1:8000/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -X POST http://127.0.0.1:8000/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

# Start server
curl -s -b /tmp/sc.txt -X POST http://127.0.0.1:8000/api/client/servers/JkIBdjyY/power \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"signal":"start"}' -w "HTTP:%{http_code}\\n"
sleep 5
echo "---wings log---"
tail -20 /tmp/wings.log | grep -iE 'error|pull|start|fail|success' | tail -10
""", timeout=30))
