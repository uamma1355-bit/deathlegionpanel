#!/usr/bin/env python3
"""Patch FileUploadController to return RELATIVE URL (so browser uses current host).
   Also patch Vercel proxy to handle multipart file uploads properly."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Patch the FileUploadController to return a relative URL
# The original returns: https://daytona-host:443/upload/file?token=...
# We change it to return: /upload/file?token=...
# This way the browser uses whatever host it's on (Vercel or Daytona direct)

patch_py = '''
path = "/home/daytona/pterodactyl-panel/app/Http/Controllers/Api/Client/Servers/FileUploadController.php"
with open(path, "r") as f:
    content = f.read()

old = """        return sprintf(
            '%s/upload/file?token=%s',
            $server->node->getConnectionAddress(),
            $token->toString()
        );"""

new = """        // Return a RELATIVE URL so the browser uses the current host
        // (works for both Vercel proxy and direct Daytona access)
        return sprintf('/upload/file?token=%s', $token->toString());"""

if old in content:
    content = content.replace(old, new)
    with open(path, "w") as f:
        f.write(content)
    print("PATCHED - upload URL is now relative")
elif "Return a RELATIVE URL" in content:
    print("ALREADY_PATCHED")
else:
    print("PATTERN_NOT_FOUND")
    idx = content.find("getUploadUrl")
    if idx >= 0:
        print(content[idx:idx+500])
'''

patch_b64 = base64.b64encode(patch_py.encode()).decode()
print("=== Patch FileUploadController ===")
print(run("echo '" + patch_b64 + "' | base64 -d > /tmp/patch_upload.py && python3 /tmp/patch_upload.py"))

# Clear cache
print("\n=== Clear cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))

# Restart PHP server
print("\n=== Restart PHP server ===")
print(run('pkill -f "php8.4 -S" 2>/dev/null; sleep 2; cd /home/daytona/pterodactyl-panel && nohup php8.4 -S 0.0.0.0:8001 /home/daytona/pterodactyl-panel/server.php > /tmp/php-server.log 2>&1 & disown; sleep 3; echo PHP restarted'))

# Test the upload URL is now relative
print("\n=== Test upload URL ===")
print(run("""# Login
curl -s -c /tmp/sc.txt -o /dev/null http://127.0.0.1:8000/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -X POST http://127.0.0.1:8000/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

# Get upload URL
curl -s -b /tmp/sc.txt http://127.0.0.1:8000/api/client/servers/29ea72ef-8dc9-416c-8db6-29699975a532/files/upload -H 'Accept: application/json' | python3 -c 'import sys,json;d=json.loads(sys.stdin.read());print("Upload URL:",d.get("attributes",{}).get("url","none")[:80])'
"""))
