#!/usr/bin/env python3
"""Fix Docker image (node_18 not found) + node health (red heart -> green)."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=120):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+10) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Pull a valid Docker image (node_20 or node_22)
print("=== Step 1: Pull valid Docker images ===")
print(run("""# Pull the available node images from pterodactyl yolks
for img in node_20 node_22 node_18; do
  echo "Pulling ghcr.io/pterodactyl/yolks:$img..."
  docker pull ghcr.io/pterodactyl/yolks:$img 2>&1 | tail -2
done
echo "---available images---"
docker images | grep -i 'pterodactyl/yolks' | head -10
""", timeout=180))

# Step 2: Update all servers to use node_20 (stable, available)
print("\n=== Step 2: Update all servers to use node_20 ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Server;
$servers = Server::all();
echo "Updating " . count($servers) . " servers...\n";
foreach ($servers as $s) {
    echo "  Server #{$s->id} ({$s->name}): image was {$s->image}\n";
    $s->image = "ghcr.io/pterodactyl/yolks:node_20";
    $s->save();
}
echo "Done. Verifying:\n";
foreach (Server::all() as $s) {
    echo "  Server #{$s->id} ({$s->name}): image now {$s->image}\n";
}
' 2>&1 | grep -v "Deprecated\|^$" | head -30""", timeout=45))

# Step 3: Also update the egg variable (docker_image) so reinstall uses the right image
print("\n=== Step 3: Update egg docker images ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Egg;
$eggs = Egg::all();
foreach ($eggs as $egg) {
    echo "Egg #{$egg->id} ({$egg->name}):\n";
    $images = $egg->docker_images;
    if (is_array($images)) {
        foreach ($images as $key => $val) {
            $images[$key] = "ghcr.io/pterodactyl/yolks:node_20";
            echo "  $key => $val\n";
        }
        $egg->docker_images = $images;
        $egg->save();
        echo "  Updated all images to node_20\n";
    }
}
' 2>&1 | grep -v "Deprecated\|^$" | head -20""", timeout=30))

# Step 4: Clear panel cache
print("\n=== Step 4: Clear panel cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))

# Step 5: Restart Wings to pick up new server configs
print("\n=== Step 5: Restart Wings ===")
print(run("""pkill -f 'wings --config' 2>/dev/null || true
sleep 3
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 8
ps aux | grep 'wings --config' | grep -v grep | head -1
echo "---wings log---"
tail -15 /tmp/wings.log 2>/dev/null
""", timeout=30))

# Step 6: Check node health
print("\n=== Step 6: Check node health ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
$n = Node::first();
echo "Node: {$n->name}\n";
echo "  scheme: {$n->scheme}\n";
echo "  fqdn: {$n->fqdn}\n";
echo "  daemonListen: {$n->daemonListen}\n";
echo "  behind_proxy: " . ($n->behind_proxy ? "yes" : "no") . "\n";
echo "  maintenance_mode: " . ($n->maintenance_mode ? "yes" : "no") . "\n";
echo "  servers: " . $n->servers()->count() . "\n";

// Check if Wings is reachable
echo "\nWings health check:\n";
try {
    $client = new \GuzzleHttp\Client();
    $resp = $client->get("http://127.0.0.1:8080/api/system", [
        "headers" => ["Authorization" => "Bearer " . $n->daemon_token_id . "." . $n->getDecryptedKey()],
        "timeout" => 5,
    ]);
    echo "  HTTP: " . $resp->getStatusCode() . "\n";
    echo "  Body: " . substr($resp->getBody(), 0, 200) . "\n";
} catch (\Exception $e) {
    echo "  ERROR: " . $e->getMessage() . "\n";
}
' 2>&1 | grep -v "Deprecated\|^$" | head -25""", timeout=30))
