#!/usr/bin/env python3
"""Fix Kernel.php once and for all — read the file, check for double backslashes, fix them."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# Read the Kernel.php, find any line with \\Illuminate (double backslash in PHP source),
# and replace with \Illuminate (single backslash). This is what PHP needs.
PATCH_SCRIPT = '''path = "/home/daytona/backend/app/Http/Kernel.php"
with open(path, "r") as f:
    content = f.read()

# In PHP source code, a namespace prefix is a single backslash: \\Illuminate\\...
# But when Python reads the file, a single backslash in PHP source is just \\ in the string.
# So we need to find literal "\\\\\\\\" (two backslashes in the file) and replace with "\\\\" (one).
# Actually, let's just read the bytes and check.
import re
# Replace any occurrence of \\\\I (double backslash before I) with \\I (single backslash)
# In Python string, \\\\\\\\ = two literal backslashes, \\\\ = one literal backslash
content = content.replace("\\\\\\\\I", "\\\\I")
# Also replace \\\\E (for Encrypt) etc.
content = content.replace("\\\\\\\\E", "\\\\E")
content = content.replace("\\\\\\\\A", "\\\\A")
content = content.replace("\\\\\\\\S", "\\\\S")
content = content.replace("\\\\\\\\C", "\\\\C")
content = content.replace("\\\\\\\\F", "\\\\F")
content = content.replace("\\\\\\\\P", "\\\\P")
content = content.replace("\\\\\\\\H", "\\\\H")
content = content.replace("\\\\\\\\R", "\\\\R")
content = content.replace("\\\\\\\\T", "\\\\T")
content = content.replace("\\\\\\\\V", "\\\\V")

with open(path, "w") as f:
    f.write(content)

# Verify
with open(path, "r") as f:
    for i, line in enumerate(f.readlines(), 1):
        if "Illuminate" in line and "use " not in line:
            print(f"Line {i}: {line.rstrip()}")
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
