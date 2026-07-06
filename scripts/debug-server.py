#!/usr/bin/env python3
"""Debug: check if the server is actually visible to the API user."""
import json
import urllib.request

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"
FRESH_KEY = "ptlc_o3cY4ZNQ6wF1nw1orjbZ10rMNzUzN5JXJ7UNnPrg2Ub"

# Get the server list to see what UUID the API returns
body = json.dumps({
    "command": f"curl -s -H 'Authorization: Bearer {FRESH_KEY}' -H 'Accept: application/json' http://127.0.0.1:8000/api/client",
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
    result = json.loads(resp.read().decode())
    data = json.loads(result.get("result", "{}"))
    if "data" in data:
        for s in data["data"]:
            a = s["attributes"]
            print(f"Server: {a['name']}")
            print(f"  UUID: {a['uuid']}")
            print(f"  Identifier: {a['identifier']}")
            print(f"  uuidInternal: {a.get('uuid', '?')}")
    else:
        print(f"Response: {json.dumps(data)[:300]}")

# Now try the server detail with the UUID from the list
print("\n=== Try server detail with internal_id or different param ===")
# Try by ID
body2 = json.dumps({
    "command": f"curl -s -o /dev/null -w '%{{http_code}}' -H 'Authorization: Bearer {FRESH_KEY}' -H 'Accept: application/json' http://127.0.0.1:8000/api/client/servers/1; echo",
    "cwd": "/home/daytona",
    "timeout": 10,
})
req2 = urllib.request.Request(
    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
    data=body2.encode(),
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req2, timeout=30) as resp2:
    r2 = json.loads(resp2.read().decode())
    print(f"  By ID (1): HTTP {r2.get('result', '').strip()}")
