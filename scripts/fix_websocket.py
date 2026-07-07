#!/usr/bin/env python3
"""Fix the websocket decrypt error - regenerate node daemon_token with current APP_KEY."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = f'https://app.daytona.io/api/toolbox/{SANDBOX_ID}/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Use artisan tinker to re-encrypt the daemon token
# The Node model stores $node->daemon_token as an encrypted string
# We need to regenerate it
tinker_script = r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
echo "=== Nodes before ===\n";
$nodes = Node::all();
foreach ($nodes as $n) {
    echo "Node #{$n->id}: {$n->name}\n";
    echo "  daemon_token (encrypted) length: " . strlen($n->getRawOriginal("daemon_token")) . "\n";
    try {
        $dec = decrypt($n->getRawOriginal("daemon_token"));
        echo "  daemon_token decrypts: OK (len=" . strlen($dec) . ")\n";
    } catch (\Exception $e) {
        echo "  daemon_token decrypt FAILED: " . $e->getMessage() . "\n";
    }
    echo "  daemon_token_id: {$n->daemon_token_id}\n";
    echo "  fqdn: {$n->fqdn}\n";
    echo "  scheme: {$n->scheme}\n";
    echo "  daemonListen: {$n->daemonListen}\n";
    echo "  daemonSFTP: {$n->daemonSFTP}\n";
}

echo "\n=== Regenerating daemon_token for all nodes ===\n";
foreach ($nodes as $n) {
    $newToken = \Pterodactyl\Models\Node::generateToken();
    $n->daemon_token = $newToken;
    $n->save();
    echo "Node #{$n->id} ({$n->name}): daemon_token regenerated\n";
    
    // Verify
    $fresh = Node::find($n->id);
    try {
        $dec = decrypt($fresh->getRawOriginal("daemon_token"));
        echo "  Verify decrypt: OK\n";
    } catch (\Exception $e) {
        echo "  Verify decrypt FAILED: " . $e->getMessage() . "\n";
    }
}

echo "\n=== Wings config check ===\n";
$cfgPath = "/etc/pterodactyl/config.yml";
if (file_exists($cfgPath)) {
    $cfg = file_get_contents($cfgPath);
    // Just show key fields
    foreach (explode("\n", $cfg) as $line) {
        if (preg_match("/^(debug|url|token_id|token|certificate|data_center|remote|host|listen_port|sftp)/i", $line)) {
            echo $line . "\n";
        }
    }
} else {
    echo "No wings config at $cfgPath\n";
}
' 2>&1 | grep -v "Deprecated\|^$" | head -60"""

print("=== Regenerate node daemon_token ===")
print(run(tinker_script, timeout=45))

# Restart Wings to pick up new token
print("\n=== Restart Wings ===")
print(run("""# Kill existing wings
pkill -f 'wings --config' 2>/dev/null || true
sleep 2

# Restart wings
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 5

# Verify wings is running
ps aux | grep wings | grep -v grep
echo "---wings log tail---"
tail -20 /tmp/wings.log 2>/dev/null
"""))

# Test websocket endpoint again
print("\n=== Test websocket endpoint ===")
print(run("""# Login and test websocket
curl -s -c /tmp/test-cookies.txt -o /dev/null http://127.0.0.1:8000/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/test-cookies.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
SESSION=$(grep pterodactyl_session /tmp/test-cookies.txt | awk '{print $7}')
curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -H "X-XSRF-TOKEN: $XSRF" -H "Cookie: XSRF-TOKEN=$(grep XSRF-TOKEN /tmp/test-cookies.txt | awk '{print $7}'); pterodactyl_session=$SESSION" \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null -b /tmp/test-cookies.txt

# Test websocket endpoint
curl -s -b /tmp/test-cookies.txt http://127.0.0.1:8000/api/client/servers/JkIBdjyY/websocket -H 'Accept: application/json'
echo
"""))
