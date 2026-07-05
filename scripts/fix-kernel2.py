#!/usr/bin/env python3
"""Fix the Kernel.php — replace \\Illuminate\\... with short names (already imported)."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

PATCH_SCRIPT = '''
with open("/home/daytona/backend/app/Http/Kernel.php", "r") as f:
    content = f.read()

# The api group has \\\\Illuminate\\\\... (double backslash) — replace with short names
# since the classes are already imported at the top
replacements = [
    ("\\\\\\\\Illuminate\\\\\\\\Session\\\\\\\\Middleware\\\\\\\\StartSession::class", "StartSession::class"),
    ("\\\\\\\\Illuminate\\\\\\\\Cookie\\\\\\\\Middleware\\\\\\\\EncryptCookies::class", "EncryptCookies::class"),
    ("\\\\\\\\Illuminate\\\\\\\\Cookie\\\\\\\\Middleware\\\\\\\\AddQueuedCookiesToResponse::class", "AddQueuedCookiesToResponse::class"),
]
for old, new in replacements:
    content = content.replace(old, new)

with open("/home/daytona/backend/app/Http/Kernel.php", "w") as f:
    f.write(content)
print("FIXED")
'''

b64 = base64.b64encode(PATCH_SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /tmp/fix.py && python3 /tmp/fix.py && cd /home/daytona/backend && php -l app/Http/Kernel.php && grep -A 8 \"'api' =>\" app/Http/Kernel.php | head -10",
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
