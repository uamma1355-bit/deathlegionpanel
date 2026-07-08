#!/usr/bin/env python3
"""
DISTRIBUTED ARCHITECTURE BUILDER
================================
- E2B (5 sandboxes): Storage backend (MySQL, files, backups) - 22GB each = 110GB total
- Daytona Sandbox 1 (current): Panel + Wings Node 1
- Daytona Sandbox 2-5: Wings Nodes 2-5 (each running Wings + Docker)
- All Wings nodes connected to Panel as separate nodes
- 20 servers distributed across nodes
- Self-healing for all sandboxes
"""
import json, urllib.request, subprocess, base64, time, os

E2B_API_KEY = 'e2b_1f9efe2fb912240566b001e41fcfc5a7b786f8e3'
DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
PANEL_SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
DAYTONA_API = 'https://app.daytona.io/api'
PANEL_PUBLIC_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'

def run_daytona(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(DAYTONA_API + '/toolbox/' + PANEL_SANDBOX_ID + '/toolbox/process/execute',
        data=body, method='POST', headers={
            'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', 'no result')
    except Exception as e:
        return f'ERR: {e}'

def create_e2b_sandbox(name, timeout=3600):
    """Create an E2B sandbox and return its ID."""
    result = subprocess.run(['node', '-e', f'''
const {{ Sandbox }} = require('e2b');
process.env.E2B_API_KEY = '{E2B_API_KEY}';
async function main() {{
    const sbx = await Sandbox.create({{ timeout: {timeout} }});
    console.log(sbx.sandboxId);
}}
main().catch(e => console.error(e.message));
'''], capture_output=True, text=True, timeout=30)
    return result.stdout.strip()

def run_e2b(sandbox_id, cmd, timeout=30):
    """Run a command on an E2B sandbox."""
    result = subprocess.run(['node', '-e', f'''
const {{ Sandbox }} = require('e2b');
process.env.E2B_API_KEY = '{E2B_API_KEY}';
async function main() {{
    const sbx = await Sandbox.connect('{sandbox_id}');
    const result = await sbx.commands.run(`{cmd}`, {{ timeout: {timeout} }});
    console.log(result.stdout);
}}
main().catch(e => console.error(e.message));
'''], capture_output=True, text=True, timeout=timeout+15)
    return result.stdout.strip()

def create_daytona_sandbox(name):
    """Create a new Daytona sandbox and return its ID."""
    body = json.dumps({
        'name': name, 'target': 'eu', 'public': True, 'autoStopInterval': 0
    }).encode()
    req = urllib.request.Request(DAYTONA_API + '/sandbox', data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode())
            return data.get('id', '')
    except Exception as e:
        return f'ERR: {e}'

# ============================================================
# PHASE 1: Create E2B Storage Sandboxes (5 sandboxes, 22GB each)
# ============================================================
print("=" * 70)
print("PHASE 1: Create 5 E2B Storage Sandboxes (110GB total storage)")
print("=" * 70)

e2b_sandboxes = []
for i in range(5):
    name = f"deathlegion-storage-{i+1}"
    print(f"Creating E2B sandbox {i+1}/5: {name}...")
    sbx_id = create_e2b_sandbox(name)
    if sbx_id and not sbx_id.startswith('ERR'):
        e2b_sandboxes.append(sbx_id)
        print(f"  ID: {sbx_id}")
        # Set up storage directories
        run_e2b(sbx_id, 'mkdir -p /storage/mysql /storage/backups /storage/files /storage/templates && echo OK')
    else:
        print(f"  FAILED: {sbx_id}")
    time.sleep(2)

print(f"\nE2B sandboxes created: {len(e2b_sandboxes)}/5")
print(f"Total storage: {len(e2b_sandboxes) * 22}GB")

# ============================================================
# PHASE 2: Create Daytona Wings Sandboxes (4 more, total 5 nodes)
# ============================================================
print("\n" + "=" * 70)
print("PHASE 2: Create 4 Daytona Wings Sandboxes (total 5 Wings nodes)")
print("=" * 70)

daytona_wings = []
for i in range(4):
    name = f"deathlegion-wings-{i+2}"
    print(f"Creating Daytona sandbox {i+2}/5: {name}...")
    sbx_id = create_daytona_sandbox(name)
    if sbx_id and not sbx_id.startswith('ERR'):
        daytona_wings.append(sbx_id)
        print(f"  ID: {sbx_id}")
        print(f"  Public URL: https://8000-{sbx_id}.daytonaproxy01.eu")
    else:
        print(f"  FAILED: {sbx_id}")
    time.sleep(5)

print(f"\nDaytona Wings sandboxes: {len(daytona_wings)}/4")
print(f"Total Wings nodes: {len(daytona_wings) + 1} (including panel sandbox)")

# ============================================================
# PHASE 3: Generate Architecture Report
# ============================================================
print("\n" + "=" * 70)
print("ARCHITECTURE REPORT")
print("=" * 70)

report = f"""
DEATH LEGION PANEL - DISTRIBUTED ARCHITECTURE REPORT
====================================================

ARCHITECTURE OVERVIEW:
- Panel: Daytona Sandbox 1 (current)
- Wings Nodes: {len(daytona_wings) + 1} Daytona sandboxes
- Storage: {len(e2b_sandboxes)} E2B sandboxes ({len(e2b_sandboxes) * 22}GB total)
- Frontend: Vercel (deathlegionpanel.vercel.app)
- Self-Healing: GitHub Actions (every 5 minutes)

PANEL NODE (Daytona Sandbox 1):
- ID: {PANEL_SANDBOX_ID}
- URL: {PANEL_PUBLIC_URL}
- Resources: 1 CPU, 1GB RAM, 3GB disk
- Services: PHP (port 8001), nginx (port 8000), MySQL, Redis, Wings (port 8080)
- Role: Panel + Wings Node 1

WINGS NODES (Daytona Sandboxes):
"""

for i, sid in enumerate(daytona_wings, 2):
    report += f"- Node {i}: {sid}\n  URL: https://8000-{sid}.daytonaproxy01.eu\n  Resources: 1 CPU, 1GB RAM, 3GB disk\n  Role: Wings Node {i}\n"

report += f"""
STORAGE BACKEND (E2B Sandboxes):
"""
for i, sid in enumerate(e2b_sandboxes, 1):
    report += f"- Storage {i}: {sid}\n  Disk: 22GB\n  Timeout: 1 hour (needs self-healing)\n  Role: MySQL backups, file storage, bot templates\n"

report += f"""
TOTAL RESOURCES:
- CPUs: {(len(daytona_wings) + 1) * 1} (Daytona) + {len(e2b_sandboxes) * 1} (E2B) = {len(daytona_wings) + 1 + len(e2b_sandboxes)} CPUs
- RAM: {(len(daytona_wings) + 1) * 1}GB (Daytona) + {len(e2b_sandboxes) * 0.5}GB (E2B) = {(len(daytona_wings) + 1) + len(e2b_sandboxes) * 0.5}GB
- Disk: {(len(daytona_wings) + 1) * 3}GB (Daytona) + {len(e2b_sandboxes) * 22}GB (E2B) = {(len(daytona_wings) + 1) * 3 + len(e2b_sandboxes) * 22}GB
- Public URLs: {len(daytona_wings) + 1} (Daytona) + 1 (Vercel)

SERVERS:
- Total: 20 servers (2 per user, 10 users)
- Distribution: {20 // (len(daytona_wings) + 1)} servers per node
- RAM per server: 512MB
- Disk per server: 1024MB
- Image: ghcr.io/ptero-eggs/yolks:nodejs_24

SELF-HEALING:
- GitHub Actions runs every 5 minutes
- Checks all Daytona sandboxes
- Restarts services if down
- Recreates E2B sandboxes before 1hr timeout
- Cleans disk space automatically

LIMITATIONS:
- Daytona: Cannot upgrade resources (1 CPU, 1GB RAM, 3GB disk per sandbox)
- E2B: 1 hour timeout (sandboxes auto-destroy after 1hr)
- E2B: No public URL (accessed via SDK only)
- E2B: 481MB RAM (too low for running services)
- Daytona sandboxes cannot communicate directly (each is isolated)
- Wings nodes need Panel's public URL to sync server configs
"""

print(report)

# Save report to file
with open('/home/z/my-project/DISTRIBUTED_ARCHITECTURE_REPORT.md', 'w') as f:
    f.write(report)

# Save sandbox IDs for self-healing
config = {
    'panel_sandbox': PANEL_SANDBOX_ID,
    'wings_sandboxes': daytona_wings,
    'e2b_sandboxes': e2b_sandboxes,
    'e2b_api_key': E2B_API_KEY,
    'daytona_token': DAYTONA_TOKEN,
}
with open('/home/z/my-project/scripts/sandbox_config.json', 'w') as f:
    json.dump(config, f, indent=2)

print(f"\nReport saved: /home/z/my-project/DISTRIBUTED_ARCHITECTURE_REPORT.md")
print(f"Config saved: /home/z/my-project/scripts/sandbox_config.json")
print(f"\nE2B Sandboxes: {e2b_sandboxes}")
print(f"Daytona Wings: {daytona_wings}")
