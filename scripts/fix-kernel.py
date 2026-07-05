#!/usr/bin/env python3
"""Patch the Kernel.php — fix the double backslashes to single."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# The patch script that fixes the file
PATCH_SCRIPT = r'''
with open("/home/daytona/backend/app/Http/Kernel.php", "r") as f:
    content = f.read()

# Replace the broken api block (has \\Illuminate double backslashes) with correct single-backslash PHP
old = """        'api' => [
            \\Illuminate\\Session\\Middleware\\StartSession::class,
            \\Illuminate\\Cookie\\Middleware\\EncryptCookies::class,
            \\Illuminate\\Cookie\\Middleware\\AddQueuedCookiesToResponse::class,
            EnsureStatefulRequests::class,
            SubstituteBindings::class,
            IsValidJson::class,
        ],"""
new = """        'api' => [
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            EnsureStatefulRequests::class,
            SubstituteBindings::class,
            IsValidJson::class,
        ],"""
content = content.replace(old, new)
with open("/home/daytona/backend/app/Http/Kernel.php", "w") as f:
    f.write(content)
print("FIXED")
'''

b64 = base64.b64encode(PATCH_SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /tmp/fix.py && python3 /tmp/fix.py && cd /home/daytona/backend && grep -A 8 \"'api' =>\" app/Http/Kernel.php | head -10",
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
