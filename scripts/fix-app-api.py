#!/usr/bin/env python3
"""Fix Kernel.php — add auth:sanctum to application-api group."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

PATCH_SCRIPT = r'''path = "/home/daytona/backend/app/Http/Kernel.php"
with open(path, "r") as f:
    content = f.read()

# Add auth:sanctum before AuthenticateApplicationUser in application-api group
old_text = "AuthenticateApplicationUser::class,"
new_text = "'auth:sanctum',\n            AuthenticateApplicationUser::class,"

# Only replace the FIRST occurrence (in application-api, not in the use statement)
idx = content.find(old_text)
if idx > 0:
    content = content[:idx] + new_text + content[idx + len(old_text):]

with open(path, "w") as f:
    f.write(content)
print("PATCHED")
'''

b64 = base64.b64encode(PATCH_SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /tmp/fix.py && python3 /tmp/fix.py && cd /home/daytona/backend && grep -A 4 'application-api' app/Http/Kernel.php | head -6",
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
