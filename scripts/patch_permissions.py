#!/usr/bin/env python3
"""Patch panel to add explicit 'connect' permission to JWT, then test."""
import json, urllib.request, subprocess

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
PUBLIC_URL = 'https://' + PUBLIC_HOST
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Patch via heredoc to a Python script on the sandbox
print("=== Step 1: Patch permissions to add 'connect' ===")
write_patch = '''cat > /tmp/patch_perms.py << 'PATCH'
path = '/home/daytona/pterodactyl-panel/app/Services/Servers/GetUserPermissionsService.php'
with open(path, 'r') as f:
    content = f.read()

old_block = (
    "        if ($user->root_admin || $user->id === $server->owner_id) {\\n"
    "            $permissions = ['*'];\\n\\n"
    "            if ($user->root_admin) {\\n"
    "                $permissions[] = 'admin.websocket.errors';\\n"
    "                $permissions[] = 'admin.websocket.install';\\n"
    "                $permissions[] = 'admin.websocket.transfer';\\n"
    "            }\\n\\n"
    "            return $permissions;\\n"
    "        }"
)

new_perms = "', '".join([
    '*', 'connect', 'websocket.connect',
    'console.read', 'console.write',
    'power.start', 'power.stop', 'power.restart', 'power.kill',
    'file.read', 'file.write', 'file.delete', 'file.create', 'file.archive', 'file.list',
    'user.read', 'user.create', 'user.update', 'user.delete',
    'backup.read', 'backup.create', 'backup.delete', 'backup.download', 'backup.restore',
    'allocation.read', 'allocation.update',
    'database.read', 'database.create', 'database.update', 'database.delete', 'database.view_password',
    'schedule.read', 'schedule.create', 'schedule.update', 'schedule.delete',
    'settings.read', 'settings.update',
    'activity.read',
    'admin.websocket.errors', 'admin.websocket.install', 'admin.websocket.transfer',
])

new_block = (
    "        if ($user->root_admin || $user->id === $server->owner_id) {\\n"
    "            $permissions = ['" + new_perms + "'];\\n\\n"
    "            return $permissions;\\n"
    "        }"
)

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(path, 'w') as f:
        f.write(content)
    print("PATCHED")
else:
    print("PATTERN NOT FOUND - showing current state")
    idx = content.find('if ($user->root_admin')
    if idx >= 0:
        print(content[idx:idx+500])
PATCH
python3 /tmp/patch_perms.py
'''
print(run(write_patch, timeout=15))

# Step 2: Clear config cache
print("\n=== Step 2: Clear config cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -2 && php artisan cache:clear 2>&1 | tail -2"))

# Step 3: Test end-to-end again
print("\n=== Step 3: Test end-to-end ===")
test_full = '''#!/bin/bash
PUBLIC_URL="''' + PUBLIC_URL + '''"

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
SOCKET=$(echo "$WS_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['socket'])")
WS_TOKEN=$(echo "$WS_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['token'])")
echo "Socket: $SOCKET"
echo "Token len: ${#WS_TOKEN}"

# Decode JWT payload to verify permissions
echo "$WS_TOKEN" | python3 -c "import sys,base64,json; t=sys.stdin.read().strip().split('.'); p=json.loads(base64.urlsafe_b64decode(t[1]+'===')); print('permissions:', p.get('permissions'))"

cat > /tmp/ws-test.js << 'JSEOF'
const WebSocket = require('ws');
const ws = new WebSocket(process.argv[2], { origin: process.argv[4] });
let timeout = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);

ws.on('open', () => {
  console.log('CONNECTED');
  ws.send(JSON.stringify({ event: 'auth', args: [process.argv[3]] }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('MSG: ' + msg.event + ' args=' + JSON.stringify(msg.args).slice(0, 300));
  if (msg.event === 'auth success') {
    ws.send(JSON.stringify({ event: 'send logs', args: [''] }));
    setTimeout(() => { clearTimeout(timeout); ws.close(); process.exit(0); }, 3000);
  }
});
ws.on('error', (err) => { console.log('ERR: ' + err.message); clearTimeout(timeout); process.exit(1); });
ws.on('close', () => { console.log('CLOSED'); clearTimeout(timeout); process.exit(0); });
JSEOF

[ ! -d /tmp/node_modules/ws ] && cd /tmp && npm install ws --silent 2>&1 | tail -2
cd /tmp && node /tmp/ws-test.js "$SOCKET" "$WS_TOKEN" "ignored" "$PUBLIC_URL" 2>&1
'''
result = subprocess.run(['bash', '-c', test_full], capture_output=True, text=True, timeout=120)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
