#!/usr/bin/env python3
"""Create index.js in all server volumes so they have something to run."""
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

# Create index.js in all server volumes
index_js = """const http = require('http');
const hostname = '0.0.0.0';
const port = process.env.SERVER_PORT || 3000;
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello from DeathLegion Panel!\\\\nServer is running.\\\\n');
});
server.listen(port, hostname, () => {
  console.log(\`Server running at http://\${hostname}:\${port}/\`);
});
"""

# Get all server UUIDs
print("=== Get all server UUIDs ===")
uuids_out = run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='use Pterodactyl\Models\Server; foreach (Server::all() as $s) { echo $s->uuid . "\n"; }' 2>&1 | grep -v Deprecated""")
print(uuids_out)
uuids = [l.strip() for l in uuids_out.strip().split('\n') if l.strip() and len(l.strip()) == 36]
print(f"Found {len(uuids)} servers")

# Write index.js to each server volume
print("\n=== Create index.js in each server volume ===")
import base64
index_b64 = base64.b64encode(index_js.encode()).decode()

for uuid in uuids:
    print(f"  Writing index.js to /var/lib/pterodactyl/volumes/{uuid}/")
    result = run(f"echo '{index_b64}' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/{uuid}/index.js > /dev/null && sudo chown pterodactyl:pterodactyl /var/lib/pterodactyl/volumes/{uuid}/index.js && echo OK")
    print(f"    {result}")

# Verify
print("\n=== Verify files ===")
print(run("ls -la /var/lib/pterodactyl/volumes/e3887f0c-15ca-4469-91c7-afa2bc8a25f0/"))

# Also create a package.json so npm start works
package_json = """{
  "name": "deathlegion-server",
  "version": "1.0.0",
  "description": "Test server",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {}
}
"""
pkg_b64 = base64.b64encode(package_json.encode()).decode()

print("\n=== Create package.json in each server volume ===")
for uuid in uuids:
    result = run(f"echo '{pkg_b64}' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/{uuid}/package.json > /dev/null && sudo chown pterodactyl:pterodactyl /var/lib/pterodactyl/volumes/{uuid}/package.json && echo OK")
    print(f"  {uuid[:8]}...: {result}")

# Now try starting the server again
print("\n=== Start server ===")
print(run("""# Login
curl -s -c /tmp/sc.txt -o /dev/null http://127.0.0.1:8000/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -X POST http://127.0.0.1:8000/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

# Get fresh CSRF
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -o /dev/null http://127.0.0.1:8000/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')

# Start
curl -s -b /tmp/sc.txt -X POST http://127.0.0.1:8000/api/client/servers/JkIBdjyY/power \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"signal":"start"}' -w "HTTP:%{http_code}\\n"

sleep 8

# Check status
echo "---status---"
curl -s -b /tmp/sc.txt http://127.0.0.1:8000/api/client/servers/JkIBdjyY/resources | python3 -c "import sys,json;d=json.loads(sys.stdin.read());a=d.get('attributes',{});print('state:',a.get('current_state','?'));print('uptime:',a.get('resources',{}).get('uptime',0),'s');print('memory:',a.get('resources',{}).get('memory_bytes',0),'bytes')"

echo "---wings log---"
tail -15 /tmp/wings.log | grep -iE 'start|boot|crash|error|success' | tail -10
""", timeout=30))
