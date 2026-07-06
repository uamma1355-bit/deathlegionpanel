#!/usr/bin/env python3
"""Fix Kernel.php — read the file, find ALL lines with double backslash before a letter, fix them."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# This script reads the file, finds any \\X (double backslash before letter), replaces with \X
PATCH_SCRIPT = '''import re

path = "/home/daytona/backend/app/Http/Kernel.php"
with open(path, "r") as f:
    content = f.read()

# Replace ALL occurrences of \\\\ followed by a capital letter with single backslash
# This fixes \\Illuminate -> \\Illuminate (PHP namespace separator)
content = re.sub(r"\\\\\\\\([A-Z])", r"\\\\\\1", content)

with open(path, "w") as f:
    f.write(content)

# Verify
with open(path, "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "Illuminate" in line and "use " not in line:
        stripped = line.rstrip()
        if "\\\\\\\\" in stripped:
            print(f"  STILL BROKEN line {i}: {stripped}")
        else:
            print(f"  OK line {i}: {stripped}")

print("FIXED")
'''

b64 = base64.b64encode(PATCH_SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /tmp/fix.py && python3 /tmp/fix.py && cd /home/daytona/backend && php -l app/Http/Kernel.php",
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
