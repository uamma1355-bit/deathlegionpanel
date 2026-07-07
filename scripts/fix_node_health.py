#!/usr/bin/env python3
"""Fix node health: browser can reach Wings, Panel uses localhost."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Set node fqdn to public URL (browser-reachable)
print("=== Step 1: Set node fqdn to public URL ===")
print(run(r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
$n = Node::first();
$n->scheme = "https";
$n->fqdn = "8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu";
$n->daemonListen = 443;
$n->behind_proxy = true;
$n->save();
$f = Node::first();
echo "scheme=" . $f->scheme . " fqdn=" . $f->fqdn . " daemonListen=" . $f->daemonListen . "\n";
echo "getConnectionAddress=" . $f->getConnectionAddress() . "\n";
' 2>&1 | grep -v Deprecated | tail -3""", timeout=30))

# Step 2: Patch DaemonRepository to use localhost for server-side calls
print("\n=== Step 2: Patch DaemonRepository to use localhost ===")
patch_script = r'''cat > /tmp/patch_daemon.py << 'PATCH'
path = '/home/daytona/pterodactyl-panel/app/Repositories/Wings/DaemonRepository.php'
with open(path, 'r') as f:
    content = f.read()

old = "return new Client([\n            'verify' => $this->app->environment('production'),\n            'base_uri' => $this->node->getConnectionAddress(),"

new = "// Always use localhost for server-side calls to Wings (panel can't reach public URL)\n        $localAddr = 'http://127.0.0.1:' . $this->node->daemonListen;\n        if ($this->node->daemonListen == 443) {\n            $localAddr = 'http://127.0.0.1:8080';\n        }\n        return new Client([\n            'verify' => false,\n            'base_uri' => $localAddr,"

if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("PATCHED")
elif 'localAddr' in content:
    print("ALREADY_PATCHED")
else:
    print("PATTERN_NOT_FOUND")
PATCH
python3 /tmp/patch_daemon.py
'''
print(run(patch_script, timeout=15))

# Step 3: Add nginx route for /api/system → Wings
print("\n=== Step 3: Update nginx to route /api/system → Wings ===")
nginx_conf = """server {
    listen 8000 default_server;
    listen [::]:8000 default_server;
    server_name _;
    
    client_max_body_size 100M;
    client_body_timeout 300s;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 60s;
    
    # WebSocket console routes -> Wings
    location ~ ^/api/servers/([^/]+)/ws$ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Wings health check (browser pings this) -> Wings
    location = /api/system {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
    }
    
    # ALL other traffic -> PHP Panel
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
"""
write_nginx = "sudo tee /etc/nginx/sites-available/pterodactyl.conf > /dev/null << 'NGINXEOF'\n" + nginx_conf + "NGINXEOF\nsudo nginx -t 2>&1\nsudo nginx -s reload 2>&1\necho NGINX_UPDATED"
print(run(write_nginx, timeout=15))

# Step 4: Clear cache
print("\n=== Step 4: Clear cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1"))

# Step 5: Test browser health check via public URL
print("\n=== Step 5: Test browser health check via public URL ===")
print(run("""# Get the daemon token
TOKEN=$(cat /tmp/get_token.php 2>/dev/null; cd /home/daytona/pterodactyl-panel && php /tmp/get_token.php 2>/dev/null | tail -1)
echo "Token (first 30): ${TOKEN:0:30}..."

# Test /api/system through public URL (simulating browser)
echo "Test via public URL:"
curl -s -o /dev/null -w "HTTP:%{http_code}\\n" --max-time 10 -H "Authorization: Bearer $TOKEN" "https://""" + PUBLIC_HOST + """/api/system"
curl -s --max-time 10 -H "Authorization: Bearer $TOKEN" "https://""" + PUBLIC_HOST + """/api/system" | head -3
"""))
