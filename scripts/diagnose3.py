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
    ("=== Recent laravel errors ===",
     "tail -100 /home/daytona/pterodactyl-panel/storage/logs/laravel-2026-07-07.log 2>/dev/null | grep -iE 'mac|invalid|error|exception' | tail -30"),
    ("=== Last 50 log lines ===",
     "tail -50 /home/daytona/pterodactyl-panel/storage/logs/laravel-2026-07-07.log 2>/dev/null"),
    ("=== Check TrustedProxy config ===",
     "cat /home/daytona/pterodactyl-panel/config/trustedproxy.php 2>/dev/null | head -50"),
    ("=== Check session config ===",
     "grep -A 30 \"'domain'\" /home/daytona/pterodactyl-panel/config/session.php 2>/dev/null | head -40"),
    ("=== Check sanctum config ===",
     "cat /home/daytona/pterodactyl-panel/config/sanctum.php 2>/dev/null | head -50"),
    ("=== Test from outside (public URL) ===",
     "curl -s -i -X POST 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/auth/login' -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'Origin: https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu' -H 'Referer: https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/' -d '{\"user\":\"admin\",\"password\":\"DeathLegion2025!\"}' 2>&1 | head -40"),
    ("=== Test from outside with XSRF ===",
     "curl -s -c /tmp/cookies.txt -o /dev/null 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/sanctum/csrf-cookie' && cat /tmp/cookies.txt | head -10"),
    ("=== Test public URL headers ===",
     "curl -s -I 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/' 2>&1 | head -20"),
    ("=== Check if React app is built ===",
     "ls /home/daytona/pterodactyl-panel/public/assets/ 2>/dev/null | head -20; echo '---'; ls /home/daytona/pterodactyl-panel/resources/views/pterodactyl/ 2>/dev/null | head -20"),
    ("=== Frontend assets check ===",
     "ls /home/daytona/pterodactyl-panel/public/build/ 2>/dev/null; echo '---'; find /home/daytona/pterodactyl-panel/public -name 'index.html' 2>/dev/null"),
]
for label, cmd in checks:
    print(label)
    print(run_cmd(cmd))
    print()
