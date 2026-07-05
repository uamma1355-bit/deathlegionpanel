#!/usr/bin/env python3
"""Patch the Kernel.php in the Daytona sandbox to add session middleware to the api group."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

PATCH_SCRIPT = r'''
import re
with open("/home/daytona/backend/app/Http/Kernel.php", "r") as f:
    content = f.read()

pattern = r"        'api' => \[.*?\],"
new_block = (
    "        'api' => [\n"
    "            \\Illuminate\\Session\\Middleware\\StartSession::class,\n"
    "            \\Illuminate\\Cookie\\Middleware\\EncryptCookies::class,\n"
    "            \\Illuminate\\Cookie\\Middleware\\AddQueuedCookiesToResponse::class,\n"
    "            EnsureStatefulRequests::class,\n"
    "            SubstituteBindings::class,\n"
    "            IsValidJson::class,\n"
    "        ],"
)
# Use a function replacement to avoid backslash escape issues in re.sub
content = re.sub(pattern, lambda m: new_block, content, flags=re.DOTALL)

with open("/home/daytona/backend/app/Http/Kernel.php", "w") as f:
    f.write(content)
print("PATCHED")
'''

b64 = base64.b64encode(PATCH_SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /tmp/patch.py && python3 /tmp/patch.py && cd /home/daytona/backend && grep -A 8 \"'api' =>\" app/Http/Kernel.php | head -10",
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
