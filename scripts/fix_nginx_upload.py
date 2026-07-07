#!/usr/bin/env python3
"""Fix nginx to route /upload/* and /download/* to Wings (file upload/download)."""
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

# New nginx config with ALL Wings routes
nginx_conf = """server {
    listen 8000 default_server;
    listen [::]:8000 default_server;
    server_name _;
    
    client_max_body_size 1024M;
    client_body_timeout 600s;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_connect_timeout 60s;
    proxy_request_buffering off;
    proxy_buffering off;
    
    # === Wings routes (browser-facing) ===
    
    # WebSocket console
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
    
    # Wings health check
    location = /api/system {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
    }
    
    # File upload (browser uploads files to Wings via /upload/file)
    location /upload/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 1024M;
    }
    
    # File download (browser downloads files from Wings via /download/file)
    location /download/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
    
    # === Panel routes (everything else) -> PHP ===
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
print("=== Update nginx config ===")
print(run(write_nginx, timeout=15))

# Test the /upload/file route through nginx
print("\n=== Test /upload/file through nginx ===")
print(run('curl -s -o /dev/null -w "POST /upload/file: HTTP:%{http_code}\\n" --max-time 5 -X POST "http://127.0.0.1:8000/upload/file?token=test"'))
print(run('curl -s -o /dev/null -w "GET /download/file: HTTP:%{http_code}\\n" --max-time 5 "http://127.0.0.1:8000/download/file?token=test"'))
print(run('curl -s -o /dev/null -w "GET /api/system: HTTP:%{http_code}\\n" --max-time 5 -H "Authorization: Bearer FZ7Nz3jEY8Y1KP4NAfVrP7CV7nkZpGYzWGAZYr4x2bcVoUYfLqn82TgMd7mUp2f6" "http://127.0.0.1:8000/api/system"'))
