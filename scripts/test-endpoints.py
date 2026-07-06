#!/usr/bin/env python3
"""Test API key on different endpoints."""
import json
import urllib.request

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# Test the API key on multiple endpoints
API_KEY = "ptlc_QZ7KkTkSh63OwnqXxMKZaw3Sa8d1JLf3Na3FQGFLLRKKqBu"

endpoints = [
    "/api/client/account",
    "/api/client",
    "/api/client/permissions",
    "/api/client/servers/e3887f0c-15ca-4469-91c7-afa2bc8a25f0",
]

for ep in endpoints:
    body = json.dumps({
        "command": f"curl -s -o /dev/null -w '%{{http_code}}' -H 'Authorization: Bearer {API_KEY}' -H 'Accept: application/json' http://127.0.0.1:8000{ep}; echo",
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
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode())
        code = result.get("result", "").strip()
        print(f"  {ep}: HTTP {code}")
