#!/usr/bin/env python3
"""Debug JWT signature verification - maybe token mismatch."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Verify the daemon_token in DB matches Wings config token
print("=== Step 1: Verify daemon_token matches Wings config ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
$n = Node::first();
echo "DB_TOKEN_ID=" . $n->daemon_token_id . "\n";
echo "DB_TOKEN_RAW=" . $n->getDecryptedKey() . "\n";
' 2>&1 | grep -E "^(DB_TOKEN)" """))

print(run("echo '---wings config token---'; grep -E '^(token_id|token):' /etc/pterodactyl/config.yml"))

# Step 2: Look at Wings binary for the EXACT error context and JWT parsing
print("\n=== Step 2: Wings - look at JWT/permission related strings ===")
print(run("strings /usr/local/bin/wings | grep -iE 'jwt|perms|permission' | head -30"))

# Step 3: Check the wings source for permission check
print("\n=== Step 3: Find the exact 'connect' permission check in Wings ===")
print(run("strings /usr/local/bin/wings | grep -B1 -A1 'missing connect' | head -20"))

# Step 4: Check if maybe Wings is using a different permission name like 'websocket.connect' vs 'connect'
print("\n=== Step 4: Find 'connect' permission strings ===")
print(run("strings /usr/local/bin/wings | grep -E '^connect$|websocket\\.connect|\"connect\"|HasPermission' | head -20"))

# Step 5: Look at wings log to see what's happening with the JWT
print("\n=== Step 5: Wings full log ===")
print(run("tail -80 /tmp/wings.log 2>/dev/null"))

# Step 6: Check if maybe Wings expects the perms in JWT header not payload
print("\n=== Step 6: Check how wings reads JWT - look at JWT parsing strings ===")
print(run("strings /usr/local/bin/wings | grep -iE 'GetClaim|permission|PermissionString|jwt.claims' | head -20"))
