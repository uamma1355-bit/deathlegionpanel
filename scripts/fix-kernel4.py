#!/usr/bin/env python3
"""Fix Kernel.php — use short class names (already imported via 'use' statements)."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# The classes StartSession, EncryptCookies, AddQueuedCookiesToResponse are already
# imported at the top of Kernel.php. Use the short names — no backslash issues.
PATCH_SCRIPT = '''path = "/home/daytona/backend/app/Http/Kernel.php"
with open(path, "r") as f:
    content = f.read()

# Replace any line containing \\Illuminate\\...\\StartSession with just StartSession
import re
# Match the full pattern with any number of backslashes
content = re.sub(r"\\\\*Illuminate\\\\*Session\\\\*Middleware\\\\*StartSession::class", "StartSession::class", content)
content = re.sub(r"\\\\*Illuminate\\\\*Cookie\\\\*Middleware\\\\*EncryptCookies::class", "EncryptCookies::class", content)
content = re.sub(r"\\\\*Illuminate\\\\*Cookie\\\\*Middleware\\\\*AddQueuedCookiesToResponse::class", "AddQueuedCookiesToResponse::class", content)

with open(path, "w") as f:
    f.write(content)
print("FIXED")
'''

b64 = base64.b64encode(PATCH_SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /tmp/fix.py && python3 /tmp/fix.py && cd /home/daytona/backend && sed -n '75,82p' app/Http/Kernel.php | cat -A",
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
