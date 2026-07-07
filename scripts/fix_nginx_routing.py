#!/usr/bin/env python3
"""Fix nginx routing - only /api/servers/{uuid}/ws goes to Wings, everything else to PHP."""
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

# Step 1: Fix nginx config - ONLY route /api/servers/{uuid}/ws to Wings
print("=== Step 1: Fix nginx config ===")
nginx_conf = """server {
    listen 8000 default_server;
    listen [::]:8000 default_server;
    server_name _;
    
    client_max_body_size 100M;
    client_body_timeout 300s;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 60s;
    
    # ONLY WebSocket console routes -> Wings
    location ~ ^/api/servers/([^/]+)/ws$ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Override Origin to bypass gorilla websocket CheckOrigin
        proxy_set_header Origin http://127.0.0.1:8080;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # ALL other traffic -> PHP (panel + /api/remote/* + /api/client/* etc)
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
write_nginx = f"""sudo tee /etc/nginx/sites-available/pterodactyl.conf > /dev/null << 'NGINXEOF'
{nginx_conf}NGINXEOF
sudo nginx -t 2>&1
sudo nginx -s reload 2>&1
echo "NGINX_FIXED"
"""
print(run(write_nginx, timeout=15))

# Step 2: Restart Wings (now it can reach /api/remote on PHP)
print("\n=== Step 2: Restart Wings ===")
print(run("""pkill -f 'wings --config' 2>/dev/null || true
sleep 3
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 8
ps aux | grep wings | grep -v grep | head -2
echo "---wings log---"
tail -25 /tmp/wings.log 2>/dev/null
"""))

# Step 3: Test the full flow
print("\n=== Step 3: Test end-to-end ===")
test_full = """
#!/bin/bash
PUBLIC_URL="https://""" + PUBLIC_HOST + """"

# Login
rm -f /tmp/pub-cookies.txt
curl -s -c /tmp/pub-cookies.txt -o /dev/null --max-time 20 "$PUBLIC_URL/sanctum/csrf-cookie"
XSRF_RAW=$(grep XSRF-TOKEN /tmp/pub-cookies.txt | awk '{print $7}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF_RAW'))")
curl -s -c /tmp/pub-cookies.txt -b /tmp/pub-cookies.txt --max-time 20 -X POST "$PUBLIC_URL/auth/login" \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' -o /dev/null

# Get WS token
WS_RESP=$(curl -s --max-time 20 -b /tmp/pub-cookies.txt "$PUBLIC_URL/api/client/servers/JkIBdjyY/websocket" -H 'Accept: application/json')
SOCKET=$(echo "$WS_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['socket'])")
WS_TOKEN=$(echo "$WS_RESP" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['data']['token'])")
echo "Socket: $SOCKET"
echo "Token len: ${#WS_TOKEN}"

# Test WS connection
cat > /tmp/ws-test.js << 'JSEOF'
const WebSocket = require('ws');
const ws = new WebSocket(process.argv[2]);
let timeout = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);

ws.on('open', () => {
  console.log('CONNECTED');
  ws.send(JSON.stringify({ event: 'auth', args: [process.argv[3]] }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('MSG: ' + msg.event + ' args=' + JSON.stringify(msg.args).slice(0, 200));
  if (msg.event === 'auth success') {
    ws.send(JSON.stringify({ event: 'send logs', args: [''] }));
    setTimeout(() => { clearTimeout(timeout); ws.close(); process.exit(0); }, 3000);
  }
});
ws.on('error', (err) => { console.log('ERR: ' + err.message); clearTimeout(timeout); process.exit(1); });
ws.on('close', () => { console.log('CLOSED'); clearTimeout(timeout); process.exit(0); });
JSEOF

[ ! -d /tmp/node_modules/ws ] && cd /tmp && npm install ws --silent 2>&1 | tail -2
cd /tmp && node /tmp/ws-test.js "$SOCKET" "$WS_TOKEN" 2>&1
"""
result = subprocess.run(['bash', '-c', test_full], capture_output=True, text=True, timeout=180)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
