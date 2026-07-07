#!/usr/bin/env python3
"""Fix JWT audience mismatch - Node fqdn should match what Wings sees as its address."""
import json, urllib.request, subprocess

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
PUBLIC_URL = f'https://{PUBLIC_HOST}'
url = f'https://app.daytona.io/api/toolbox/{SANDBOX_ID}/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# The problem: the JWT's `aud` claim is the node's getConnectionAddress() which we set to
# `https://8000-...daytonaproxy01.eu:443`. Wings checks this against its own listener.
# But Wings listens on 127.0.0.1:8080 — it doesn't see itself as :443.
# 
# Pterodactyl actually handles this differently — the JWT is signed with the node's 
# daemonToken and the aud is checked against the request's Host. Let me look at the JWT 
# verification in Wings.
#
# Actually looking at "jwt: missing connect permission" — this is a different error. 
# The JWT was decoded successfully but the permission check failed. Looking at the 
# permissions array in the token: ["*", "admin.websocket.errors", ...]. The "connect" 
# permission is what's missing.
#
# Looking at Pterodactyl Wings source for websocket connect permission:
# It's typically "websocket.connect" or the server_uuid is checked. Let me look 
# at what permission strings Wings expects.

# Step 1: Check what permission Wings wants for connect
print("=== Step 1: Look at Wings websocket permission check ===")
print(run("strings /usr/local/bin/wings | grep -iE 'websocket\\.|connect.*permission|permission.*connect' | head -20"))

# Step 2: Look at the NodeJWTService to see what permissions are set
print("\n=== Step 2: Check NodeJWTService source ===")
print(run("grep -A 30 'setClaims\\|->handle\\|permissions' /home/daytona/pterodactyl-panel/app/Services/Nodes/NodeJWTService.php | head -60"))

# Step 3: Check the controller that issues websocket tokens
print("\n=== Step 3: Check WebsocketController ===")
print(run("find /home/daytona/pterodactyl-panel -name 'WebsocketController*' -exec cat {} \\; 2>/dev/null | head -80"))
PYEOF
print("Script start...")
PYEOF

import sys
sys.path.insert(0, '/tmp')
