#!/usr/bin/env python3
"""Fix nginx routing so /api/remote/* also goes to Wings (panel->Wings API)."""
import json, urllib.request, subprocess

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
PUBLIC_URL = 'https://' + PUBLIC_HOST
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Update nginx config to route /api/remote/* to Wings
print("=== Update nginx config ===")
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
    
    # Panel->Wings daemon API (used by panel to fetch files, resources, send commands)
    location ~ ^/api/remote/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    
    # ALL other traffic -> PHP (panel UI + /api/client/* + /auth/* etc)
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
write_nginx = """sudo tee /etc/nginx/sites-available/pterodactyl.conf > /dev/null << 'NGINXEOF'
""" + nginx_conf + """NGINXEOF
sudo nginx -t 2>&1
sudo nginx -s reload 2>&1
echo "NGINX_UPDATED"
"""
print(run(write_nginx, timeout=15))

# Test all endpoints again
print("\n=== Test all endpoints ===")
test = '''#!/bin/bash
PUBLIC_URL="''' + PUBLIC_URL + '''"
SERVER_ID="JkIBdjyY"

rm -f /tmp/pub-cookies.txt
curl -s -c /tmp/pub-cookies.txt -o /dev/null --max-time 20 "$PUBLIC_URL/sanctum/csrf-cookie"
XSRF_RAW=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{print $7}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")
curl -s -c /tmp/pub-cookies.txt -b /tmp/pub-cookies.txt --max-time 20 -X POST "$PUBLIC_URL/auth/login" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

echo "--- Files (list) ---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/$SERVER_ID/files/list" -H 'Accept: application/json' | head -1
echo
echo "--- Resources ---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/$SERVER_ID/resources" -H 'Accept: application/json' | head -1
echo
echo "--- Power start ---"
curl -s --max-time 20 -b /tmp/pub-cookies.txt -c /tmp/pub-cookies.txt -X POST "$PUBLIC_URL/api/client/servers/$SERVER_ID/power" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"signal":"start"}' -w "HTTP:%{http_code}\\n"
'''
result = subprocess.run(['bash', '-c', test], capture_output=True, text=True, timeout=120)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
