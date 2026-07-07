#!/usr/bin/env python3
"""Properly fix the daemon_token - encrypt it before saving."""
import json, urllib.request, subprocess

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = f'https://app.daytona.io/api/toolbox/{SANDBOX_ID}/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Generate a fresh raw token, encrypt it, save to DB
print("=== Step 1: Encrypt and save daemon_token properly ===")
tinker1 = r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
use Illuminate\Support\Str;
use Illuminate\Encryption\Encrypter;

$node = Node::first();

// Generate a fresh raw token
$rawToken = Str::random(64);
$tokenId = Str::random(16);

// Encrypt it using the app encrypter
$encrypted = app("encrypter")->encrypt($rawToken);

// Save DIRECTLY to DB (bypassing any mutators) using a raw query
\DB::table("nodes")->where("id", $node->id)->update([
    "daemon_token" => $encrypted,
    "daemon_token_id" => $tokenId,
]);

// Verify
$fresh = Node::find($node->id);
echo "TOKEN_ID=" . $tokenId . "\n";
echo "TOKEN=" . $rawToken . "\n";

try {
    $dec = $fresh->getDecryptedKey();
    echo "VERIFY=OK len=" . strlen($dec) . "\n";
} catch (\Exception $e) {
    echo "VERIFY=FAILED " . $e->getMessage() . "\n";
}
' 2>&1 | grep -E "^(TOKEN_ID|TOKEN|VERIFY)=" """

out = run(tinker1, timeout=45)
print(out)

# Parse
token_id = ""
token = ""
verify = ""
for line in out.strip().split("\n"):
    if line.startswith("TOKEN_ID="):
        token_id = line[len("TOKEN_ID="):].strip()
    elif line.startswith("TOKEN="):
        token = line[len("TOKEN="):].strip()
    elif line.startswith("VERIFY="):
        verify = line[len("VERIFY="):].strip()

print(f"\nParsed: id={token_id} token={token[:30]}... verify={verify}")

if not token_id or not token:
    print("FAILED to get token, aborting")
    exit(1)

# Step 2: Update Wings config.yml with the new token
print("\n=== Step 2: Update Wings config.yml ===")
update_cfg_cmd = f"""cat > /tmp/cfg-update.py << 'PYEOF'
import re
with open('/etc/pterodactyl/config.yml', 'r') as f:
    cfg = f.read()

# Update token_id and token - YAML format
cfg = re.sub(r'^token_id:\\s*.*$', f'token_id: "{token_id}"', cfg, flags=re.MULTILINE)
cfg = re.sub(r'^token:\\s*.*$', f'token: "{token}"', cfg, flags=re.MULTILINE)

# Make sure url points to public URL
cfg = re.sub(r'^url:\\s*.*$', 'url: https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu', cfg, flags=re.MULTILINE)

with open('/etc/pterodactyl/config.yml', 'w') as f:
    f.write(cfg)
print("OK")
PYEOF
sudo python3 /tmp/cfg-update.py
echo "---verify config---"
grep -E '^(url|token_id|token|host|remote):' /etc/pterodactyl/config.yml | head -10"""
print(run(update_cfg_cmd, timeout=15))

# Step 3: Restart Wings with the new config
print("\n=== Step 3: Restart Wings ===")
print(run("""pkill -f 'wings --config' 2>/dev/null || true
sleep 2
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 6
ps aux | grep wings | grep -v grep | head -2
echo "---wings log tail---"
tail -25 /tmp/wings.log 2>/dev/null
"""))

# Step 4: Test websocket endpoint
print("\n=== Step 4: Test websocket via public URL ===")
test_ws = f"""#!/bin/bash
PUBLIC_URL="https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu"
rm -f /tmp/pub-cookies.txt

# Get CSRF
curl -s -c /tmp/pub-cookies.txt -o /dev/null --max-time 20 "$PUBLIC_URL/sanctum/csrf-cookie"
XSRF_RAW=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{{print $7}}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")

# Login
curl -s -c /tmp/pub-cookies.txt -b /tmp/pub-cookies.txt --max-time 20 -X POST "$PUBLIC_URL/auth/login" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{{"user":"admin","password":"DeathLegion2025!"}}' -o /dev/null

echo "---websocket---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/JkIBdjyY/websocket" -H 'Accept: application/json'
echo
"""
result = subprocess.run(['bash', '-c', test_ws], capture_output=True, text=True, timeout=120)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
