#!/usr/bin/env python3
"""Fix: remove SubstituteBindings from the api group."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# Use a simpler patch that doesn't have newline-in-string issues
PATCH_SCRIPT = '''path = "/home/daytona/backend/app/Http/Kernel.php"
with open(path, "r") as f:
    lines = f.readlines()

new_lines = []
skip_next = False
for i, line in enumerate(lines):
    if "SubstituteBindings::class" in line and i > 0:
        # Check if we're in the api group (look back for 'api' =>)
        context = "".join(lines[max(0,i-10):i])
        if "'api' =>" in context:
            # Skip this line — remove SubstituteBindings from api group
            continue
    new_lines.append(line)

with open(path, "w") as f:
    f.writelines(new_lines)
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
