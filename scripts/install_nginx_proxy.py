#!/usr/bin/env python3
"""Install nginx reverse proxy in front of PHP to handle WebSocket routing.
   nginx :8000 → routes /api/servers/{uuid}/ws to Wings :8080
                       everything else to PHP :8001
"""
import json, urllib.request, subprocess

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
url = f'https://app.daytona.io/api/toolbox/{SANDBOX_ID}/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Install nginx if not installed
print("=== Step 1: Install nginx ===")
print(run("""which nginx || (sudo apt-get update -qq && sudo apt-get install -y -qq nginx) 2>&1 | tail -5
nginx -v 2>&1"""))

# Step 2: Move PHP to port 8001
print("\n=== Step 2: Move PHP to port 8001 ===")
print(run("""pkill -f 'php8.4 -S' 2>/dev/null; sleep 2
cd /home/daytona/pterodactyl-panel
nohup php8.4 -S 0.0.0.0:8001 /home/daytona/pterodactyl-panel/server.php > /tmp/php-server.log 2>&1 &
disown
sleep 3
ss -tlnp | grep :8001
echo "PHP_NOW_ON_8001"
"""))

# Step 3: Write nginx config
print("\n=== Step 3: Write nginx config ===")
nginx_conf = f"""server {{
    listen 8000 default_server;
    listen [::]:8000 default_server;
    server_name _;
    
    client_max_body_size 100M;
    client_body_timeout 120s;
    
    # WebSocket routes - route to Wings on 8080
    location ~ ^/api/servers/([^/]+)/ws$ {{
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }}
    
    # Wings daemon API (used by panel to talk to Wings)
    location ~ ^/(api/remote|daemon) {{
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }}
    
    # All other traffic -> PHP built-in server on 8001
    location / {{
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        # Pass through cookies, etc.
        proxy_pass_request_headers on;
    }}
}}
"""
write_nginx = f"""sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
sudo tee /etc/nginx/sites-available/pterodactyl.conf > /dev/null << 'NGINXEOF'
{nginx_conf}NGINXEOF
sudo ln -sf /etc/nginx/sites-available/pterodactyl.conf /etc/nginx/sites-enabled/pterodactyl.conf
# Remove default site if exists
sudo rm -f /etc/nginx/sites-enabled/default
# Test config
sudo nginx -t 2>&1
echo "NGINX_CONFIG_DONE"
"""
print(run(write_nginx, timeout=30))

# Step 4: Start nginx
print("\n=== Step 4: Start nginx ===")
print(run("""sudo pkill -f 'nginx: master' 2>/dev/null || true
sleep 1
sudo nginx
sleep 2
ss -tlnp | grep ':8000\\|:8001\\|:8080' | head -10
echo "NGINX_STARTED"
"""))

# Step 5: Update Node config to use the public URL for WebSocket
print("\n=== Step 5: Update Node fqdn/scheme so websocket URL points to public host ===")
tinker_node = r"""cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='
use Pterodactyl\Models\Node;
$node = Node::first();
echo "BEFORE: scheme=" . $node->scheme . " fqdn=" . $node->fqdn . " daemonListen=" . $node->daemonListen . "\n";
$node->scheme = "https";
$node->fqdn = "8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu";
$node->daemonListen = 443;
$node->daemonSFTP = 2022;
$node->behind_proxy = true;
$node->save();
$fresh = Node::first();
echo "AFTER:  scheme=" . $fresh->scheme . " fqdn=" . $fresh->fqdn . " daemonListen=" . $fresh->daemonListen . "\n";
echo "getConnectionAddress: " . $fresh->getConnectionAddress() . "\n";
' 2>&1 | grep -v "Deprecated\|^$" | head -10"""
print(run(tinker_node, timeout=30))

# Step 6: Test everything via public URL
print("\n=== Step 6: Test via public URL ===")
test_full = """
#!/bin/bash
PUBLIC_URL="https://""" + PUBLIC_HOST + """"
rm -f /tmp/pub-cookies.txt

echo "--- Home page ---"
curl -s -o /dev/null -w "HTTP:%{http_code} SIZE:%{size_download}\\n" --max-time 20 "$PUBLIC_URL/"

echo "--- Static asset ---"
curl -s -o /dev/null -w "bundle: HTTP:%{http_code} SIZE:%{size_download}\\n" --max-time 20 "$PUBLIC_URL/assets/bundle.bae76759.js"

echo "--- CSRF ---"
curl -s -c /tmp/pub-cookies.txt -o /dev/null --max-time 20 "$PUBLIC_URL/sanctum/csrf-cookie"

XSRF_RAW=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{print $7}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")

echo "--- Login ---"
curl -s -c /tmp/pub-cookies.txt -b /tmp/pub-cookies.txt --max-time 20 -X POST "$PUBLIC_URL/auth/login" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' | head -1
echo

echo "--- List servers ---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client" -H 'Accept: application/json' > /tmp/servers.json
python3 -c "import json; d=json.load(open('/tmp/servers.json')); print('servers:', len(d.get('data', []))); [print(' -', s['attributes']['name'], '('+s['attributes']['identifier']+')') for s in d.get('data', [])]"

echo "--- Websocket token ---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/JkIBdjyY/websocket" -H 'Accept: application/json' > /tmp/ws-resp.json
python3 -c "import json; d=json.load(open('/tmp/ws-resp.json')); data=d.get('data', {}); print('socket:', data.get('socket', 'none')); print('token len:', len(data.get('token', '')))"
"""
result = subprocess.run(['bash', '-c', test_full], capture_output=True, text=True, timeout=180)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
