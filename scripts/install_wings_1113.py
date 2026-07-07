#!/usr/bin/env python3
"""Install Wings 1.11.13 which is compatible with Panel 1.11.3."""
import json, urllib.request, subprocess

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=120):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Download Wings 1.11.13 (the correct compatible version)
print("=== Step 1: Download Wings 1.11.13 ===")
print(run("""cd /tmp
# Try multiple URLs for wings 1.11.13
for url in \\
  "https://github.com/pterodactyl/wings/releases/download/v1.11.13/wings_linux_amd64" \\
  "https://github.com/pterodactyl/wings/releases/download/v1.11.12/wings_linux_amd64" \\
  "https://github.com/pterodactyl/wings/releases/download/v1.11.11/wings_linux_amd64" \\
  "https://github.com/pterodactyl/wings/releases/download/v1.11.10/wings_linux_amd64"; do
  echo "Trying: $url"
  if curl -sLf -o /tmp/wings-new "$url"; then
    echo "SUCCESS: downloaded from $url"
    ls -la /tmp/wings-new
    break
  fi
done
""", timeout=120))

# Step 2: Verify download and install
print("\n=== Step 2: Install Wings 1.11.13 ===")
print(run("""file /tmp/wings-new
chmod +x /tmp/wings-new
# Backup old wings
sudo cp /usr/local/bin/wings /usr/local/bin/wings.v1.13.1.bak
# Install new wings
sudo cp /tmp/wings-new /usr/local/bin/wings
sudo chmod +x /usr/local/bin/wings
/usr/local/bin/wings version 2>&1 | head -5
""", timeout=30))

# Step 3: Revert the permission patch since 1.11.13 uses the standard format
print("\n=== Step 3: Revert WebsocketController patch ===")
print(run(r'''cat > /tmp/revert.py << 'PATCH'
path = '/home/daytona/pterodactyl-panel/app/Http/Controllers/Api/Client/Servers/WebsocketController.php'
with open(path, 'r') as f:
    content = f.read()

old = """->setClaims([
                'server_uuid' => $server->uuid,
                'permissions' => $permissions,
                'perms' => $permissions,
                'scopes' => $permissions,
            ])"""

new = """->setClaims([
                'server_uuid' => $server->uuid,
                'permissions' => $permissions,
            ])"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("REVERTED")
else:
    print("Already in original state")
PATCH
python3 /tmp/revert.py
''', timeout=15))

# Step 4: Restart Wings with new version
print("\n=== Step 4: Restart Wings ===")
print(run("""pkill -f 'wings --config' 2>/dev/null || true
sleep 3
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 8
ps aux | grep wings | grep -v grep | head -2
echo "---wings log---"
tail -20 /tmp/wings.log 2>/dev/null
""", timeout=30))

# Step 5: Clear panel cache
print("\n=== Step 5: Clear panel cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -2 && php artisan cache:clear 2>&1 | tail -2"))

# Step 6: Test WebSocket end-to-end
print("\n=== Step 6: Test end-to-end ===")
test = '''#!/bin/bash
PUBLIC_URL="https://''' + PUBLIC_HOST + '''"
rm -f /tmp/pub-cookies.txt
curl -s -c /tmp/pub-cookies.txt -o /dev/null --max-time 20 "$PUBLIC_URL/sanctum/csrf-cookie"
XSRF_RAW=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{print $7}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")
curl -s -c /tmp/pub-cookies.txt -b /tmp/pub-cookies.txt --max-time 20 -X POST "$PUBLIC_URL/auth/login" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

WS_RESP=$(curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/JkIBdjyY/websocket" -H 'Accept: application/json')
SOCKET=$(echo "$WS_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['socket'])")
WS_TOKEN=$(echo "$WS_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['token'])")
echo "Socket: $SOCKET"

cat > /tmp/ws-test.js << 'JSEOF'
const WebSocket = require('ws');
const ws = new WebSocket(process.argv[2], { origin: process.argv[4] });
let timeout = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);
ws.on('open', () => { console.log('CONNECTED'); ws.send(JSON.stringify({ event: 'auth', args: [process.argv[3]] })); });
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('MSG: ' + msg.event + ' args=' + JSON.stringify(msg.args).slice(0, 300));
  if (msg.event === 'auth success') { ws.send(JSON.stringify({ event: 'send logs', args: [''] })); setTimeout(() => { clearTimeout(timeout); ws.close(); process.exit(0); }, 3000); }
});
ws.on('error', (err) => { console.log('ERR: ' + err.message); clearTimeout(timeout); process.exit(1); });
ws.on('close', () => { console.log('CLOSED'); clearTimeout(timeout); process.exit(0); });
JSEOF
[ ! -d /tmp/node_modules/ws ] && cd /tmp && npm install ws --silent 2>&1 | tail -2
cd /tmp && node /tmp/ws-test.js "$SOCKET" "$WS_TOKEN" "ignored" "$PUBLIC_URL" 2>&1
'''
result = subprocess.run(['bash', '-c', test], capture_output=True, text=True, timeout=120)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
