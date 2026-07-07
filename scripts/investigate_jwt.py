#!/usr/bin/env python3
"""Investigate JWT permission issue."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = f'https://app.daytona.io/api/toolbox/{SANDBOX_ID}/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Check Wings for permission strings
print("=== Step 1: Wings permission strings ===")
print(run("strings /usr/local/bin/wings | grep -iE 'websocket\\.connect|connect.*permission|missing.*permission|jwt.*permission' | head -20"))

# Step 2: Check the JWT service and what claims are added
print("\n=== Step 2: NodeJWTService full source ===")
print(run("cat /home/daytona/pterodactyl-panel/app/Services/Nodes/NodeJWTService.php"))

# Step 3: Check WebsocketController
print("\n=== Step 3: WebsocketController ===")
print(run("find /home/daytona/pterodactyl-panel -name 'WebsocketController*' -exec cat {} \\; 2>/dev/null"))
