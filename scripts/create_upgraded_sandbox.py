#!/usr/bin/env python3
"""Create a NEW Daytona sandbox with 8GB RAM, 20GB disk, 4 CPU.
   Then deploy Pterodactyl on it and migrate data."""
import json, urllib.request, time

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
API = 'https://app.daytona.io/api'

# Step 1: Create new sandbox with upgraded resources
print("=" * 70)
print("CREATING NEW SANDBOX: 4 CPU, 8GB RAM, 20GB Disk")
print("=" * 70)

create_body = json.dumps({
    "name": "pterodactyl-upgraded",
    "target": "eu",
    "cpu": 4,
    "memory": 8,
    "disk": 20,
    "public": True,
    "autoStopInterval": 0,
    "autoArchiveInterval": 43200,
}).encode()

req = urllib.request.Request(
    API + '/sandbox',
    data=create_body,
    method='POST',
    headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN,
        'Content-Type': 'application/json',
    }
)

try:
    with urllib.request.urlopen(req, timeout=60) as r:
        result = json.loads(r.read().decode())
        print(json.dumps(result, indent=2))
        new_sandbox_id = result.get('id', '')
        print(f"\nNew Sandbox ID: {new_sandbox_id}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")
except Exception as e:
    print(f"Error: {e}")
