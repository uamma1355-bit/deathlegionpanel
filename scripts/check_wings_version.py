#!/usr/bin/env python3
"""Check Wings version and downgrade if needed to match Panel 1.11.3."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Check Wings version
print("=== Wings version ===")
print(run("/usr/local/bin/wings version 2>&1"))

# Check the actual WebsocketPayload struct - look at the strings more carefully
# to find what JWT claim name it reads for permissions
print("\n=== WebsocketPayload strings ===")
print(run("strings /usr/local/bin/wings | grep -iE 'WebsocketPayload|websocket_payload' | head -20"))

# Look for 'perms' as a standalone string (JSON tag)
print("\n=== Look for perms/json tags ===")
print(run("strings /usr/local/bin/wings | grep -E 'json:\"perms' | head -10"))

# Look at the router/tokens package
print("\n=== tokens package symbols ===")
print(run("strings /usr/local/bin/wings | grep -E 'router/tokens\\.' | head -30"))

# Check the Pterodactyl Wings releases - the actual compatible version
# Panel 1.11.3 should work with Wings 1.11.x. Let me check what version 1.13.1 is.
print("\n=== Check wings binary info ===")
print(run("file /usr/local/bin/wings; stat /usr/local/bin/wings | head -10"))

# Try to find the JWT claim key in the binary
print("\n=== Search for JWT claim keys ===")
print(run("strings /usr/local/bin/wings | grep -E '^(perms|permissions|user_uuid|server_uuid|unique_id|user_id)$' | head -10"))
