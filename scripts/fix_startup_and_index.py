#!/usr/bin/env python3
"""Fix: 1) startup command syntax error, 2) index.js escaped backticks."""
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

# Fix 1: Change startup command to just 'node index.js' (simpler, no shell parsing issues)
print("=== Fix 1: Update startup command to 'node index.js' ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Egg;
$servers = Server::all();
foreach ($servers as $s) {
    $s->startup = "node index.js";
    $s->save();
}
$eggs = Egg::all();
foreach ($eggs as $egg) {
    $egg->startup = "node index.js";
    $egg->save();
}
echo "Updated " . count($servers) . " servers and " . count($eggs) . " eggs\n";
' 2>&1 | grep -v Deprecated | tail -3""", timeout=30))

# Fix 2: Write proper index.js (no escaped backticks)
print("\n=== Fix 2: Write proper index.js ===")
index_js = '''const http = require('http');
const hostname = '0.0.0.0';
const port = process.env.SERVER_PORT || 3000;
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello from DeathLegion Panel! Server is running.\\n');
});
server.listen(port, hostname, () => {
  console.log('Server running at http://' + hostname + ':' + port + '/');
});
'''
index_b64 = base64.b64encode(index_js.encode()).decode()

# Get all server UUIDs
uuids_out = run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='use Pterodactyl\Models\Server; foreach (Server::all() as $s) { echo $s->uuid . "\n"; }' 2>&1 | grep -v Deprecated""")
uuids = [l.strip() for l in uuids_out.strip().split('\n') if l.strip() and len(l.strip()) == 36]
print(f"Found {len(uuids)} servers")

for uuid in uuids:
    result = run("echo '" + index_b64 + "' | base64 -d | sudo tee /var/lib/pterodactyl/volumes/" + uuid + "/index.js > /dev/null && sudo chown pterodactyl:pterodactyl /var/lib/pterodactyl/volumes/" + uuid + "/index.js && echo OK")
    print(f"  {uuid[:8]}...: {result.strip()}")

# Verify
print("\n=== Verify index.js ===")
print(run("cat /var/lib/pterodactyl/volumes/e3887f0c-15ca-4469-91c7-afa2bc8a25f0/index.js"))

# Clear cache
print("\n=== Clear cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))

# Restart Wings to pick up new startup commands
print("\n=== Restart Wings ===")
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 8; ps aux | grep 'wings --config' | grep -v grep | head -1; echo '---log---'; tail -5 /tmp/wings.log", timeout=30))

# Test starting the server
print("\n=== Start server ===")
print(run("""# Login via public URL
curl -s -c /tmp/sc.txt -o /dev/null https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -X POST https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

# Get fresh CSRF
curl -s -c /tmp/sc.txt -b /tmp/sc.txt -o /dev/null https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sc.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')

# Start
curl -s -b /tmp/sc.txt -X POST https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client/servers/JkIBdjyY/power \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"signal":"start"}' -w "HTTP:%{http_code}\\n"

sleep 8

# Check status
echo "---status---"
curl -s -b /tmp/sc.txt https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/client/servers/JkIBdjyY/resources | python3 -c "import sys,json;d=json.loads(sys.stdin.read());a=d.get('attributes',{});print('state:',a.get('current_state','?'));print('uptime:',a.get('resources',{}).get('uptime',0),'s');print('memory:',a.get('resources',{}).get('memory_bytes',0),'bytes')"

echo "---wings log---"
tail -10 /tmp/wings.log | grep -iE 'start|boot|crash|error|success' | tail -8

echo "---container logs---"
sudo docker logs e3887f0c-15ca-4469-91c7-afa2bc8a25f0 2>&1 | tail -10

echo "---docker ps---"
sudo docker ps | head -5
""", timeout=30))
