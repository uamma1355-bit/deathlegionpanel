#!/usr/bin/env python3
"""Fix websocket - find correct way to regenerate node daemon token."""
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

# Find the right way to regenerate the daemon token
# In Pterodactyl, this is done via NodeRepository::update or the node's setDaemonTokenAttribute mutator
tinker_script = r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
use Pterodactyl\Services\Nodes\NodeUpdateService;
use Illuminate\Support\Str;

echo "=== Node model methods ===\n";
$node = Node::first();
$methods = get_class_methods($node);
$relevant = array_filter($methods, fn($m) => stripos($m, "token") !== false || stripos($m, "daemon") !== false);
echo "Relevant methods: " . implode(", ", $relevant) . "\n";

echo "\n=== Node attributes ===\n";
$fillable = $node->getFillable();
echo "Fillable: " . implode(", ", $fillable) . "\n";

echo "\n=== Try setting daemon_token directly ===\n";
$newToken = Str::random(64);
echo "New token (raw): $newToken\n";
$node->daemon_token = $newToken;
$node->save();
echo "Saved. Re-fetching...\n";
$fresh = Node::find($node->id);
try {
    $dec = decrypt($fresh->getRawOriginal("daemon_token"));
    echo "Decrypt: OK (len=" . strlen($dec) . ")\n";
    echo "Matches new: " . ($dec === $newToken ? "YES" : "NO - got different value") . "\n";
} catch (\Exception $e) {
    echo "Decrypt FAILED: " . $e->getMessage() . "\n";
}

echo "\n=== Also generate new daemon_token_id ===\n";
$node->daemon_token_id = Str::random(16);
$node->save();
echo "New daemon_token_id: " . Node::find($node->id)->daemon_token_id . "\n";

echo "\n=== Update wings config.yml with new token ===\n";
$cfgPath = "/etc/pterodactyl/config.yml";
if (file_exists($cfgPath)) {
    $cfg = file_get_contents($cfgPath);
    echo "Current token_id: " . (preg_match("/^token_id:\s*(\S+)/m", $cfg, $m) ? $m[1] : "not found") . "\n";
}
' 2>&1 | grep -v "Deprecated\|^$" | head -50"""

print("=== Fix daemon_token ===")
print(run(tinker_script, timeout=45))

# Update Wings config.yml with the new token_id and token
print("\n=== Update Wings config.yml ===")
update_cfg = r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
$node = Node::first();
$tokenId = $node->daemon_token_id;
$tokenRaw = decrypt($node->getRawOriginal("daemon_token"));
echo "TOKEN_ID=" . $tokenId . "\n";
echo "TOKEN=" . $tokenRaw . "\n";
' 2>&1 | grep -E "^(TOKEN_ID|TOKEN)=" """
out = run(update_cfg, timeout=30)
print(out)

# Parse token id and token from output
lines = out.strip().split("\n")
token_id = ""
token = ""
for line in lines:
    if line.startswith("TOKEN_ID="):
        token_id = line[len("TOKEN_ID="):].strip()
    elif line.startswith("TOKEN="):
        token = line[len("TOKEN="):].strip()
print(f"\nParsed: token_id={token_id[:20]}... token={token[:20]}...")

# Now write these to Wings config.yml
if token_id and token:
    write_cfg = f"""cat > /tmp/wings-cfg-update.py << 'PYEOF'
import re
with open('/etc/pterodactyl/config.yml', 'r') as f:
    cfg = f.read()
cfg = re.sub(r'^token_id:\\s*.*$', f'token_id: {repr(token_id)}', cfg, flags=re.MULTILINE)
cfg = re.sub(r'^token:\\s*.*$', f'token: {repr(token)}', cfg, flags=re.MULTILINE)
with open('/etc/pterodactyl/config.yml', 'w') as f:
    f.write(cfg)
print("Config updated")
PYEOF
sudo python3 /tmp/wings-cfg-update.py
echo "---verify---"
grep -E '^(token_id|token):' /etc/pterodactyl/config.yml"""
    print(run(write_cfg, timeout=15))

# Restart wings with the new token
print("\n=== Restart Wings ===")
print(run("""pkill -f 'wings --config' 2>/dev/null || true
sleep 2
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 6
ps aux | grep wings | grep -v grep | head -3
echo "---wings log---"
tail -25 /tmp/wings.log 2>/dev/null
"""))

# Test websocket endpoint with proper cookie jar
print("\n=== Test websocket endpoint via public URL ===")
test_ws = """# Login via public URL using cookie jar
curl -s -c /tmp/pub-cookies.txt -o /dev/null https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/sanctum/csrf-cookie

XSRF_RAW=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{print $7}')
SESSION=$(grep pterodactyl_session /tmp/pub-cookies.txt | awk '{print $7}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")

curl -s -c /tmp/pub-cookies.txt -b /tmp/pub-cookies.txt -X POST https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}'

echo
echo "---websocket test---"
curl -s -b /tmp/pub-cookies.txt https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client/servers/JkIBdjyY/websocket -H 'Accept: application/json'
echo
"""
# Run this from outside the sandbox since the public URL isn't reachable from inside
import subprocess
result = subprocess.run(['bash', '-c', test_ws], capture_output=True, text=True, timeout=60)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
