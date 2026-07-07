#!/usr/bin/env python3
"""Find the exact JWT claim name Wings 1.13.1 expects, then patch Panel to send it."""
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

# Search for all JWT-related json tags in the binary
print("=== All JSON tags with 'perm' or 'scope' ===")
print(run("strings /usr/local/bin/wings | grep -iE 'json:\"[^\"]*(perm|scope)' | sort -u | head -30"))

# Look for the WebsocketPayload struct definition - check for fields like Scopes, Permissions
print("\n=== Look for scope/perm field names ===")
print(run("strings /usr/local/bin/wings | grep -E '^(Scopes|Permissions|UserPermissions|ServerUuid|UserUUID|scopes|user_permissions)$' | sort -u"))

# Check what claims the JWT parser looks for
print("\n=== JWT-related claim strings ===")
print(run("strings /usr/local/bin/wings | grep -E '^(server_uuid|user_uuid|permissions|perms|scopes|unique_id|user_id|jti|iss|aud|sub|iat|nbf|exp)$' | sort -u"))

# Try patching the JWT to use 'perms' instead of 'permissions'
print("\n=== Try: add 'perms' claim to JWT ===")
patch = r'''cat > /tmp/patch_jwt.py << 'PATCH'
# Patch WebsocketController to also send 'perms' claim
path = '/home/daytona/pterodactyl-panel/app/Http/Controllers/Api/Client/Servers/WebsocketController.php'
with open(path, 'r') as f:
    content = f.read()

old = """->setClaims([
                'server_uuid' => $server->uuid,
                'permissions' => $permissions,
            ])"""

new = """->setClaims([
                'server_uuid' => $server->uuid,
                'permissions' => $permissions,
                'perms' => $permissions,
                'scopes' => $permissions,
            ])"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("PATCHED")
else:
    print("PATTERN NOT FOUND")
    print(content[content.find("setClaims"):content.find("setClaims")+300])
PATCH
python3 /tmp/patch_jwt.py
'''
print(run(patch, timeout=15))

# Clear cache
print("\n=== Clear cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -2 && php artisan cache:clear 2>&1 | tail -2"))

# Restart wings to clear any JTI denylist
print("\n=== Restart Wings ===")
print(run("""pkill -f 'wings --config' 2>/dev/null || true
sleep 3
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 6
ps aux | grep wings | grep -v grep | head -2
"""))
