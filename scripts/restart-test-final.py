#!/usr/bin/env python3
"""Restart backend + test login + create API key + test everything."""
import json
import urllib.request

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

body = json.dumps({
    "command": "cd /home/daytona/backend && sed -i 's|^APP_DEBUG=.*|APP_DEBUG=false|' .env && php artisan config:clear 2>&1 | tail -1 && php artisan config:cache 2>&1 | tail -1 && sudo pkill -9 -f 'artisan serve' 2>/dev/null; sleep 2 && setsid nohup php artisan serve --host=0.0.0.0 --port=8000 --no-interaction > storage/logs/server.log 2>&1 < /dev/null & disown && sleep 4 && echo '=== LOGIN ===' && curl -s -H 'Accept: application/json' -H 'Content-Type: application/json' -X POST -d '{\"user\":\"admin\",\"password\":\"DeathLegion2025!\"}' http://127.0.0.1:8000/api/client/auth/login && echo && echo '=== API KEY ===' && curl -s -c /tmp/ck.txt -H 'Accept: application/json' -H 'Content-Type: application/json' -X POST -d '{\"user\":\"admin\",\"password\":\"DeathLegion2025!\"}' http://127.0.0.1:8000/api/client/auth/login > /dev/null && curl -s -b /tmp/ck.txt -H 'Accept: application/json' -H 'Content-Type: application/json' -X POST -d '{\"description\":\"test\",\"allowed_ips\":[]}' http://127.0.0.1:8000/api/client/account/api-keys && echo && rm /tmp/ck.txt",
    "cwd": "/home/daytona",
    "timeout": 30,
})
req = urllib.request.Request(
    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
    data=body.encode(),
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req, timeout=60) as resp:
    print(resp.read().decode())
