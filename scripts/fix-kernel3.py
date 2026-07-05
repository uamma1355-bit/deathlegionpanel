#!/usr/bin/env python3
"""Fix Kernel.php by reading the file, replacing the api group, writing it back."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# Read the file, fix it, write it back — all in Python on the sandbox
PATCH_SCRIPT = '''import re
path = "/home/daytona/backend/app/Http/Kernel.php"
with open(path, "r") as f:
    lines = f.readlines()

new_lines = []
in_api_block = False
for line in lines:
    if line.strip() == "'api' => [":
        in_api_block = True
        new_lines.append(line)
        # Write the correct api block with single backslashes
        new_lines.append("            \\\\Illuminate\\\\Session\\\\Middleware\\\\StartSession::class,\\n")
        new_lines.append("            \\\\Illuminate\\\\Cookie\\\\Middleware\\\\EncryptCookies::class,\\n")
        new_lines.append("            \\\\Illuminate\\\\Cookie\\\\Middleware\\\\AddQueuedCookiesToResponse::class,\\n")
        new_lines.append("            EnsureStatefulRequests::class,\\n")
        new_lines.append("            SubstituteBindings::class,\\n")
        new_lines.append("            IsValidJson::class,\\n")
        continue
    if in_api_block:
        if line.strip() == "],":
            new_lines.append(line)
            in_api_block = False
        # Skip the old (broken) lines
        continue
    new_lines.append(line)

with open(path, "w") as f:
    f.writelines(new_lines)
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
