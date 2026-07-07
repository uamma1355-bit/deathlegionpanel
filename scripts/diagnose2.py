#!/usr/bin/env python3
import os, json, urllib.request, urllib.error
DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
DAYTONA_API = 'https://app.daytona.io/api'

def run_cmd(cmd, timeout=30):
    url = f'{DAYTONA_API}/toolbox/{SANDBOX_ID}/toolbox/process/execute'
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+5) as r:
            data = json.loads(r.read().decode())
            return data.get('result', '') or f'[exit:{data.get("exitCode")}]'
    except urllib.error.HTTPError as e:
        return f'HTTP {e.code}: {e.read().decode()[:500]}'
    except Exception as e:
        return f'ERR: {e}'

checks = [
    ("=== pterodactyl-panel .env ===",
     "cat /home/daytona/pterodactyl-panel/.env 2>/dev/null | grep -v '^#' | grep -v '^$'"),
    ("=== pterodactyl-full .env ===",
     "cat /home/daytona/pterodactyl-full/.env 2>/dev/null | grep -v '^#' | grep -v '^$'"),
    ("=== Which panel is running? ===",
     "ls -la /proc/34801/cwd 2>/dev/null; cat /proc/34801/cmdline 2>/dev/null | tr '\\0' ' '; echo"),
    ("=== Panel dir structure ===",
     "ls /home/daytona/pterodactyl-panel/ 2>/dev/null | head -20; echo '---'; ls /home/daytona/pterodactyl-full/ 2>/dev/null | head -20"),
    ("=== PHP version ===",
     "php -v 2>&1 | head -3"),
    ("=== Test login endpoint ===",
     "curl -s -i -X POST http://127.0.0.1:8000/auth/login -H 'Content-Type: application/json' -H 'Accept: application/json' -d '{\"user\":\"admin\",\"password\":\"DeathLegion2025!\"}' 2>&1 | head -30"),
    ("=== Test sanctum csrf ===",
     "curl -s -i http://127.0.0.1:8000/sanctum/csrf-cookie 2>&1 | head -15"),
    ("=== Check artisan config ===",
     "cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='echo \"APP_KEY=\".config(\"app.key\").\"\\nSESSION_DOMAIN=\".config(\"session.domain\").\"\\nSESSION_DRIVER=\".config(\"session.driver\").\"\\nSANCTUM_STATEFUL=\".implode(\",\",config(\"sanctum.stateful\"));' 2>&1 | tail -20"),
    ("=== Storage logs ===",
     "ls -la /home/daytona/pterodactyl-panel/storage/logs/ 2>/dev/null; tail -30 /home/daytona/pterodactyl-panel/storage/logs/laravel.log 2>/dev/null"),
]
for label, cmd in checks:
    print(label)
    print(run_cmd(cmd))
    print()
