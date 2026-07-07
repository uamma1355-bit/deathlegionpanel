#!/usr/bin/env python3
"""Fix Wings allowed_origins to accept the public Daytona URL."""
import json, urllib.request, subprocess

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
url = f'https://app.daytona.io/api/toolbox/{SANDBOX_ID}/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Update Wings config.yml to allow the public origin
print("=== Step 1: Update Wings config.yml with allowed_origins ===")
update_cfg = f"""cat > /tmp/cfg-update.py << 'PYEOF'
import re
with open('/etc/pterodactyl/config.yml', 'r') as f:
    cfg = f.read()

# Add allowed_origins after api section if not present
if 'allowed_origins' not in cfg:
    # Insert before 'remote:' line or at end
    if 'remote:' in cfg:
        cfg = cfg.replace('remote:', 'allowed_origins:\\n  - "*"\\nremote:', 1)
    else:
        cfg += '\\nallowed_origins:\\n  - "*"\\n'

with open('/etc/pterodactyl/config.yml', 'w') as f:
    f.write(cfg)
print("Updated")
PYEOF
sudo python3 /tmp/cfg-update.py
echo "---config check---"
cat /etc/pterodactyl/config.yml | head -30"""
print(run(update_cfg, timeout=15))

# Step 2: Restart Wings
print("\n=== Step 2: Restart Wings ===")
print(run("""pkill -f 'wings --config' 2>/dev/null || true
sleep 2
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 6
ps aux | grep wings | grep -v grep | head -2
echo "---wings started---"
tail -10 /tmp/wings.log 2>/dev/null
"""))

# Step 3: Test the websocket end-to-end through public URL
print("\n=== Step 3: Test WebSocket end-to-end ===")
test_ws = """
#!/bin/bash
set -e
PUBLIC_URL="https://""" + PUBLIC_HOST + """"
WS_URL="wss://""" + PUBLIC_HOST + """/api/servers/e3887f0c-15ca-4469-91c7-afa2bc8a25f0/ws"

# Login
rm -f /tmp/pub-cookies.txt
curl -s -c /tmp/pub-cookies.txt -o /dev/null --max-time 20 "$PUBLIC_URL/sanctum/csrf-cookie"
XSRF_RAW=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{print $7}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")
curl -s -c /tmp/pub-cookies.txt -b /tmp/pub-cookies.txt --max-time 20 -X POST "$PUBLIC_URL/auth/login" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

WS_RESP=$(curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/JkIBdjyY/websocket" -H 'Accept: application/json')
WS_TOKEN=$(echo "$WS_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['token'])")
SOCKET=$(echo "$WS_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['socket'])")
echo "Socket URL: $SOCKET"

# Test with Node.js ws client - set Origin to match public URL
cat > /tmp/ws-test.js << 'JSEOF'
const WebSocket = require('ws');
const url = process.argv[2];
const token = process.argv[3];
const origin = process.argv[4];
const ws = new WebSocket(url, { origin: origin, headers: { 'Origin': origin } });
let timeout = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);

ws.on('open', () => {
  console.log('CONNECTED');
  ws.send(JSON.stringify({ event: 'auth', args: [token] }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('MSG event=' + msg.event + ' args=' + JSON.stringify(msg.args).slice(0, 200));
  if (msg.event === 'auth success') {
    ws.send(JSON.stringify({ event: 'send logs', args: [''] }));
    setTimeout(() => { clearTimeout(timeout); ws.close(); process.exit(0); }, 3000);
  }
});
ws.on('error', (err) => { console.log('ERR: ' + err.message); clearTimeout(timeout); process.exit(1); });
ws.on('close', () => { console.log('CLOSED'); clearTimeout(timeout); process.exit(0); });
JSEOF

if [ ! -d /tmp/node_modules/ws ]; then
  cd /tmp && npm install ws --silent 2>&1 | tail -2
fi
cd /tmp && node /tmp/ws-test.js "$SOCKET" "$WS_TOKEN" "https://""" + PUBLIC_HOST + """" 2>&1
"""
result = subprocess.run(['bash', '-c', test_ws], capture_output=True, text=True, timeout=120)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
