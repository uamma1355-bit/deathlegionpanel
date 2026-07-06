#!/usr/bin/env python3
"""Test the server detail endpoint directly on the backend with API key."""
import json
import urllib.request

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

body = json.dumps({
    "command": "curl -s -H 'Authorization: Bearer ptlc_QZ7KkTkSh63OwnqXxMKZaw3Sa8d1JLf3Na3FQGFLLRKKqBu' -H 'Accept: application/json' http://127.0.0.1:8000/api/client/servers/e3887f0c-15ca-4469-91c7-afa2bc8a25f0; echo",
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
