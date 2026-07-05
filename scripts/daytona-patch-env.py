#!/usr/bin/env python3
"""Patch the .env in the sandbox by writing a python script to /tmp and running it."""
import json
import urllib.request

TOKEN = "<DAYTONA_TOKEN>"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"
PUBLIC_URL = f"https://pterodactyl-backend-{SANDBOX}.daytonaproxy01.eu"

# Step 1: Write the patch script to /tmp/patch_env.py via base64
PATCH_SCRIPT = '''
import re

patches = [
    ("APP_ENV", "production"),
    ("APP_DEBUG", "false"),
    ("APP_URL", "''' + PUBLIC_URL + '''"),
    ("FRONTEND_URL", "https://deathlegionpanel.vercel.app"),
    ("FORCE_HTTPS", "true"),
    ("DB_HOST", "127.0.0.1"),
    ("DB_PORT", "3306"),
    ("DB_DATABASE", "pterodactyl"),
    ("DB_USERNAME", "pterodactyl"),
    ("DB_PASSWORD", "<MYSQL_APP_PW>"),
    ("REDIS_HOST", "127.0.0.1"),
    ("REDIS_PASSWORD", ""),
    ("CACHE_DRIVER", "redis"),
    ("SESSION_DRIVER", "redis"),
    ("SESSION_DOMAIN", ".daytonaproxy01.eu"),
    ("SESSION_SAMESITE", "none"),
    ("SESSION_SECURE_COOKIE", "true"),
    ("QUEUE_CONNECTION", "redis"),
    ("SANCTUM_STATEFUL_DOMAINS", "deathlegionpanel.vercel.app,localhost,localhost:5173,127.0.0.1:5173"),
    ("CORS_ALLOWED_ORIGINS", "https://deathlegionpanel.vercel.app,http://localhost:5173"),
    ("MAIL_MAILER", "log"),
    ("RECAPTCHA_ENABLED", "false"),
    ("LOG_CHANNEL", "stderr"),
]

with open("/home/daytona/backend/.env", "r") as f:
    content = f.read()

for key, val in patches:
    pattern = rf"^{key}=.*$"
    replacement = f"{key}={val}"
    content, count = re.subn(pattern, replacement, content, flags=re.MULTILINE)
    if count == 0:
        content += f"\\n{replacement}\\n"

with open("/home/daytona/backend/.env", "w") as f:
    f.write(content)
print("PATCHED")
'''

import base64
b64 = base64.b64encode(PATCH_SCRIPT.encode()).decode()

# Write the script via printf
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /tmp/patch_env.py && python3 /tmp/patch_env.py",
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
with urllib.request.urlopen(req) as resp:
    print("Patch result:", resp.read().decode())

# Verify
body = json.dumps({
    "command": "grep -E '^(APP_URL|DB_HOST|DB_PASSWORD|SESSION_DOMAIN|SANCTUM_STATEFUL_DOMAINS|CORS_ALLOWED_ORIGINS)' /home/daytona/backend/.env",
    "cwd": "/home/daytona",
    "timeout": 10,
})
req = urllib.request.Request(
    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
    data=body.encode(),
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req) as resp:
    print("Verify:", resp.read().decode())
