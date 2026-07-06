#!/usr/bin/env python3
"""Check the {server} binding + SubstituteClientBindings middleware."""
import json
import urllib.request

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

body = json.dumps({
    "command": "cd /home/daytona/backend && grep -A 5 'server' app/Providers/RouteServiceProvider.php | grep -A 5 'bind\\|model' | head -20; echo '---'; cat app/Http/Middleware/Api/Client/SubstituteClientBindings.php 2>/dev/null | head -40",
    "cwd": "/home/daytona",
    "timeout": 15,
})
req = urllib.request.Request(
    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
    data=body.encode(),
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req, timeout=30) as resp:
    print(resp.read().decode())
