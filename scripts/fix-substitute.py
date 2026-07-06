#!/usr/bin/env python3
"""Fix: remove SubstituteBindings from the api group (conflicts with SubstituteClientBindings)."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

PATCH_SCRIPT = '''
path = "/home/daytona/backend/app/Http/Kernel.php"
with open(path, "r") as f:
    content = f.read()

# Remove the SubstituteBindings line from the api group
# (it conflicts with SubstituteClientBindings in client-api)
old = "            SubstituteBindings::class,\n            IsValidJson::class,"
new = "            IsValidJson::class,"
content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)
print("PATCHED")
'''

b64 = base64.b64encode(PATCH_SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /tmp/patch.py && python3 /tmp/patch.py && cd /home/daytona/backend && grep -A 6 \"'api' =>\" app/Http/Kernel.php | head -8",
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
