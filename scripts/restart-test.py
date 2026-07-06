#!/usr/bin/env python3
"""Restart server + test the server detail endpoint."""
import json
import urllib.request

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

body = json.dumps({
    "command": "cd /home/daytona/backend && sed -i 's|^APP_DEBUG=.*|APP_DEBUG=false|' .env && php artisan config:clear 2>&1 | tail -1 && php artisan config:cache 2>&1 | tail -1 && sudo pkill -9 -f 'artisan serve' 2>/dev/null; sleep 2 && setsid nohup php artisan serve --host=0.0.0.0 --port=8000 --no-interaction > storage/logs/server.log 2>&1 < /dev/null & disown && sleep 4 && echo '=== Test server detail ===' && curl -s -H 'Authorization: Bearer ptlc_o3cY4ZNQ6wF1nw1orjbZ10rMNzUzN5JXJ7UNnPrg2Ub' -H 'Accept: application/json' http://127.0.0.1:8000/api/client/servers/e3887f0c-15ca-4469-91c7-afa2bc8a25f0 | head -5",
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
