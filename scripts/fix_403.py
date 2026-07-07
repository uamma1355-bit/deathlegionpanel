#!/usr/bin/env python3
"""Fix nginx routing: /api/remote/* should go to PHP (Panel), not Wings.
   Only /api/servers/{uuid}/ws goes to Wings."""
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

# Fix nginx config - only WebSocket goes to Wings, everything else to PHP
print("=== Fix nginx config ===")
nginx_conf = """server {
    listen 8000 default_server;
    listen [::]:8000 default_server;
    server_name _;
    
    client_max_body_size 100M;
    client_body_timeout 300s;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 60s;
    
    # ONLY WebSocket console routes -> Wings (browser needs to reach Wings for console)
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
    
    # ALL other traffic -> PHP Panel
    # This includes:
    #   /api/client/*     - browser client API
    #   /api/remote/*     - Wings daemon calls Panel (IMPORTANT: must go to PHP, not Wings!)
    #   /api/application/* - admin API
    #   /auth/*           - auth routes
    #   /assets/*         - static assets
    #   /                 - React SPA
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
echo "NGINX_FIXED"
"""
print(run(write_nginx, timeout=15))

# Test that Wings can now reach Panel
print("\n=== Test Wings -> Panel /api/remote/servers ===")
print(run("""TOKEN_ID=$(grep '^token_id:' /etc/pterodactyl/config.yml | awk '{print $2}' | tr -d '"')
TOKEN=$(grep '^token:' /etc/pterodactyl/config.yml | awk '{print $2}' | tr -d '"')
curl -s -o /dev/null -w "HTTP:%{http_code}\\n" --max-time 10 -H "Authorization: Bearer $TOKEN_ID.$TOKEN" -H "Accept: application/json" "http://127.0.0.1:8000/api/remote/servers?per_page=50&page=1"
"""))

# Restart Wings to clear the error state
print("\n=== Restart Wings ===")
print(run("""pkill -f 'wings --config' 2>/dev/null || true
sleep 3
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 8
ps aux | grep 'wings --config' | grep -v grep | head -1
echo "---wings log tail---"
tail -20 /tmp/wings.log 2>/dev/null | grep -iE 'error|sync|403' | tail -10
"""))
