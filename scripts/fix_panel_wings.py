#!/usr/bin/env python3
"""Fix: node uses localhost:8080 for panel->Wings, but WebsocketController overrides socket URL for browser."""
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

# Step 1: Set node back to localhost:8080 for panel->Wings direct connection
print("=== Step 1: Set node to localhost:8080 ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
$n = Node::first();
$n->scheme = "http";
$n->fqdn = "127.0.0.1";
$n->daemonListen = 8080;
$n->daemonSFTP = 2022;
$n->behind_proxy = true;
$n->save();
$fresh = Node::first();
echo "scheme=" . $fresh->scheme . " fqdn=" . $fresh->fqdn . " daemonListen=" . $fresh->daemonListen . "\n";
echo "getConnectionAddress=" . $fresh->getConnectionAddress() . "\n";
' 2>&1 | grep -v Deprecated | head -5"""))

# Step 2: Patch WebsocketController to override socket URL with public URL for browser
print("\n=== Step 2: Patch WebsocketController to use public URL for browser ===")
print(run(r'''cat > /tmp/patch_ws.py << 'PATCH'
path = '/home/daytona/pterodactyl-panel/app/Http/Controllers/Api/Client/Servers/WebsocketController.php'
with open(path, 'r') as f:
    content = f.read()

# Find the line that builds $socket and replace with public URL
old = """        $socket = str_replace(['https://', 'http://'], ['wss://', 'ws://'], $node->getConnectionAddress());

        return new JsonResponse([
            'data' => [
                'token' => $token->toString(),
                'socket' => $socket . sprintf('/api/servers/%s/ws', $server->uuid),
            ],
        ]);"""

new = """        // Use the public-facing URL for browser WebSocket connections.
        // The panel itself talks to Wings on localhost:8080 directly, but browsers
        // need to reach Wings through the public reverse proxy.
        $publicHost = env('WINGS_PUBLIC_HOST', '""" + PUBLIC_HOST + """');
        $socket = 'wss://' . $publicHost . '/api/servers/' . $server->uuid . '/ws';

        return new JsonResponse([
            'data' => [
                'token' => $token->toString(),
                'socket' => $socket,
            ],
        ]);"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("PATCHED")
else:
    print("PATTERN NOT FOUND - current content:")
    idx = content.find('$socket')
    if idx >= 0:
        print(content[idx:idx+500])
PATCH
python3 /tmp/patch_ws.py
''', timeout=15))

# Step 3: Add WINGS_PUBLIC_HOST to .env
print("\n=== Step 3: Add WINGS_PUBLIC_HOST to .env ===")
print(run(f"""grep -q 'WINGS_PUBLIC_HOST' /home/daytona/pterodactyl-panel/.env || echo 'WINGS_PUBLIC_HOST={PUBLIC_HOST}' >> /home/daytona/pterodactyl-panel/.env
grep WINGS_PUBLIC_HOST /home/daytona/pterodactyl-panel/.env"""))

# Step 4: Clear cache
print("\n=== Step 4: Clear cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -2 && php artisan cache:clear 2>&1 | tail -2"))

# Step 5: Test all endpoints
print("\n=== Step 5: Test all endpoints ===")
test = '''#!/bin/bash
PUBLIC_URL="''' + PUBLIC_URL + '''"
SERVER_ID="JkIBdjyY"

rm -f /tmp/pub-cookies.txt
curl -s -c /tmp/pub-cookies.txt -o /dev/null --max-time 20 "$PUBLIC_URL/sanctum/csrf-cookie"
XSRF_RAW=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{print $7}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")
curl -s -c /tmp/pub-cookies.txt -b /tmp/pub-cookies.txt --max-time 20 -X POST "$PUBLIC_URL/auth/login" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

echo "--- Websocket token ---"
WS_RESP=$(curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/$SERVER_ID/websocket" -H 'Accept: application/json')
echo "$WS_RESP" | python3 -c "import sys,json;d=json.loads(sys.stdin.read());print('socket:',d.get('data',{}).get('socket','none'))"

echo "--- Files (list) ---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/$SERVER_ID/files/list" -H 'Accept: application/json' | head -1
echo
echo "--- Resources ---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/$SERVER_ID/resources" -H 'Accept: application/json' | head -1
echo
echo "--- Power start ---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt -X POST "$PUBLIC_URL/api/client/servers/$SERVER_ID/power" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"signal":"start"}' -w "HTTP:%{http_code}\\n" 2>&1 | head -3
'''
result = subprocess.run(['bash', '-c', test], capture_output=True, text=True, timeout=120)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
