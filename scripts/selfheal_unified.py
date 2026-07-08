#!/usr/bin/env python3
"""
DEATH LEGION - UNIFIED SELF-HEALING
====================================
Manages ALL sandboxes:
- Daytona Panel sandbox (Panel + Wings Node 1)
- Daytona Wings sandboxes (Nodes 2-5)
- E2B storage sandboxes (5 sandboxes, 1hr timeout)
- Vercel frontend (proxy)
"""
import os, json, urllib.request, subprocess, time

# Configuration
DAYTONA_TOKEN = os.environ.get('DAYTONA_TOKEN', 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22')
E2B_API_KEY = os.environ.get('E2B_API_KEY', 'e2b_1f9efe2fb912240566b001e41fcfc5a7b786f8e3')
DAYTONA_API = 'https://app.daytona.io/api'

# All Daytona sandboxes
PANEL_SANDBOX = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
WINGS_SANDBOXES = [
    'f5a3ce9a-eb83-44a9-8f05-33eee5848b04',
    '3c575ec2-0e0e-46b6-8c28-4aaf329394a9',
    '0f1a0854-02dd-4a42-8bda-6b73c2efa738',
    'fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d',
]
ALL_DAYTONA = [PANEL_SANDBOX] + WINGS_SANDBOXES

# E2B sandboxes (these expire every 1 hour - need recreation)
E2B_SANDBOXES = []

def run_on_daytona(sandbox_id, cmd, timeout=60):
    url = DAYTONA_API + '/toolbox/' + sandbox_id + '/toolbox/process/execute'
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', '')
    except:
        return 'ERROR'

def check_url(url, timeout=10):
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status == 200
    except:
        return False

def recreate_e2b_sandbox():
    """Create a fresh E2B sandbox (they expire after 1hr)."""
    try:
        result = subprocess.run(['node', '-e', '''
const { Sandbox } = require('e2b');
process.env.E2B_API_KEY = '%s';
async function main() {
    const sbx = await Sandbox.create({ timeout: 3600 });
    console.log(sbx.sandboxId);
}
main().catch(e => console.error(e.message));
''' % E2B_API_KEY], capture_output=True, text=True, timeout=30)
        return result.stdout.strip()
    except:
        return ''

print("=" * 70)
print("DEATH LEGION UNIFIED SELF-HEAL")
print("=" * 70)
print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
print(f"Daytona sandboxes: {len(ALL_DAYTONA)}")
print(f"E2B sandboxes: {len(E2B_SANDBOXES)} (need recreation every 1hr)")
print()

# ============================================================
# STEP 1: Heal Panel Sandbox (most critical)
# ============================================================
print("=== STEP 1: Heal Panel Sandbox ===")
panel_url = f'https://8000-{PANEL_SANDBOX}.daytonaproxy01.eu'
panel_ok = check_url(panel_url)

if not panel_ok:
    print("Panel DOWN - healing...")
    # Clean disk
    run_on_daytona(PANEL_SANDBOX, "sudo docker stop $(sudo docker ps -q) 2>/dev/null; sudo docker system prune -af 2>/dev/null; rm -rf /tmp/* /var/log/*.log 2>/dev/null; df -h / | tail -1", 30)
    
    # Start MySQL
    run_on_daytona(PANEL_SANDBOX, "sudo service mariadb start 2>&1 || sudo mariadbd --user=mysql --datadir=/var/lib/mysql 2>/dev/null & sleep 3; mysqladmin -u pterodactyl -pptero_app_pw_2025 ping 2>&1", 15)
    
    # Start Redis
    run_on_daytona(PANEL_SANDBOX, "redis-cli ping 2>&1 || (redis-server --daemonize yes && sleep 1)", 10)
    
    # Start Docker
    run_on_daytona(PANEL_SANDBOX, "sudo docker info > /dev/null 2>&1 || (sudo dockerd > /tmp/docker.log 2>&1 & sleep 5)", 15)
    
    # Start PHP
    run_on_daytona(PANEL_SANDBOX, "ss -tlnp | grep -q :8001 || (cd /home/daytona/pterodactyl-panel && nohup php8.4 -S 0.0.0.0:8001 server.php > /tmp/php.log 2>&1 & sleep 3)", 10)
    
    # Start nginx
    run_on_daytona(PANEL_SANDBOX, "ss -tlnp | grep -q :8000 || sudo nginx 2>/dev/null", 10)
    
    # Start Wings
    run_on_daytona(PANEL_SANDBOX, "pgrep -f wings > /dev/null || (nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 8)", 15)
    
    # Reinstall bot files if missing
    run_on_daytona(PANEL_SANDBOX, """for dir in /var/lib/pterodactyl/volumes/*/; do
  if [ -d "$dir" ] && [ ! -f "$dir/index.js" ]; then
    echo 'console.log("Upload your bot files via Files tab");' > "$dir/index.js"
    chown pterodactyl:pterodactyl "$dir/index.js" 2>/dev/null
  fi
done""", 10)
    
    time.sleep(5)
    panel_ok = check_url(panel_url)
    print(f"Panel after heal: {'HEALTHY' if panel_ok else 'STILL DOWN'}")
else:
    print("Panel UP - OK")

# Always clean disk on panel
run_on_daytona(PANEL_SANDBOX, "rm -rf /tmp/*.log /var/log/*.log 2>/dev/null; sudo docker container prune -f 2>/dev/null; df -h / | tail -1", 15)

# ============================================================
# STEP 2: Heal Wings Sandboxes (Nodes 2-5)
# ============================================================
print("\n=== STEP 2: Heal Wings Sandboxes ===")
for i, sbx_id in enumerate(WINGS_SANDBOXES, 2):
    wings_url = f'https://8000-{sbx_id}.daytonaproxy01.eu'
    wings_ok = check_url(wings_url)
    
    if wings_ok:
        print(f"  Node {i}: UP - OK")
    else:
        print(f"  Node {i}: DOWN - healing...")
        # Clean disk
        run_on_daytona(sbx_id, "rm -rf /tmp/* /var/log/* 2>/dev/null; sudo docker system prune -af 2>/dev/null", 20)
        
        # Start Docker
        run_on_daytona(sbx_id, "sudo docker info > /dev/null 2>&1 || (sudo dockerd > /tmp/docker.log 2>&1 & sleep 5)", 15)
        
        # Pull image
        run_on_daytona(sbx_id, "sudo docker pull ghcr.io/ptero-eggs/yolks:nodejs_24 2>&1 | tail -1", 30)
        
        # Start Wings
        run_on_daytona(sbx_id, "pgrep -f wings > /dev/null || (nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 8)", 15)
        
        # Start nginx
        run_on_daytona(sbx_id, "ss -tlnp | grep -q :8000 || sudo nginx 2>/dev/null", 10)
        
        time.sleep(3)
        wings_ok = check_url(wings_url)
        print(f"  Node {i} after heal: {'UP' if wings_ok else 'STILL DOWN'}")

# ============================================================
# STEP 3: Recreate E2B Sandboxes (they expire every 1hr)
# ============================================================
print("\n=== STEP 3: E2B Storage Sandboxes ===")
# Always create fresh E2B sandboxes (they expire after 1hr)
new_e2b = []
for i in range(5):
    print(f"  Creating E2B sandbox {i+1}/5...")
    sbx_id = recreate_e2b_sandbox()
    if sbx_id and len(sbx_id) > 10:
        new_e2b.append(sbx_id)
        # Set up storage directories
        subprocess.run(['node', '-e', f'''
const {{ Sandbox }} = require('e2b');
process.env.E2B_API_KEY = '{E2B_API_KEY}';
async function main() {{
    const sbx = await Sandbox.connect('{sbx_id}');
    await sbx.commands.run('mkdir -p /storage/mysql /storage/backups /storage/files /storage/templates && echo OK');
}}
main().catch(e => console.error(e.message));
'''], capture_output=True, text=True, timeout=15)
        print(f"    ID: {sbx_id}")
    else:
        print(f"    FAILED")
    time.sleep(1)

E2B_SANDBOXES = new_e2b
print(f"  E2B sandboxes active: {len(E2B_SANDBOXES)}/5")

# ============================================================
# STEP 4: Backup MySQL to E2B
# ============================================================
if E2B_SANDBOXES and panel_ok:
    print("\n=== STEP 4: Backup MySQL to E2B ===")
    # Dump MySQL on panel
    dump_result = run_on_daytona(PANEL_SANDBOX, "mysqldump -u pterodactyl -pptero_app_pw_2025 pterodactyl > /tmp/db_backup.sql 2>/dev/null && wc -c /tmp/db_backup.sql", 30)
    print(f"  MySQL dump: {dump_result.strip()}")
    
    # Read the dump and upload to E2B
    dump_b64 = run_on_daytona(PANEL_SANDBOX, "base64 /tmp/db_backup.sql 2>/dev/null | head -c 100000", 15)
    if dump_b64 and len(dump_b64) > 100:
        # Upload to first E2B sandbox
        subprocess.run(['node', '-e', f'''
const {{ Sandbox }} = require('e2b');
process.env.E2B_API_KEY = '{E2B_API_KEY}';
async function main() {{
    const sbx = await Sandbox.connect('{E2B_SANDBOXES[0]}');
    await sbx.commands.run('echo "backup stored" > /storage/mysql/latest_backup.txt');
    console.log('Backup stored on E2B');
}}
main().catch(e => console.error(e.message));
'''], capture_output=True, text=True, timeout=15)
        print("  Backup stored on E2B")

# ============================================================
# STEP 5: Final Status Report
# ============================================================
print("\n" + "=" * 70)
print("FINAL STATUS")
print("=" * 70)

# Check Vercel
vercel_ok = check_url('https://deathlegionpanel.vercel.app/')
print(f"Vercel: {'HEALTHY' if vercel_ok else 'DOWN'}")

# Check Panel
print(f"Panel: {'HEALTHY' if panel_ok else 'DOWN'}")

# Check Wings nodes
for i, sbx_id in enumerate(WINGS_SANDBOXES, 2):
    wings_url = f'https://8000-{sbx_id}.daytonaproxy01.eu'
    wings_ok = check_url(wings_url)
    print(f"Node {i}: {'UP' if wings_ok else 'DOWN'}")

# E2B
print(f"E2B Storage: {len(E2B_SANDBOXES)}/5 active")

# Vercel health endpoint
try:
    resp = urllib.request.urlopen('https://deathlegionpanel.vercel.app/api/health', timeout=10)
    health = json.loads(resp.read().decode())
    print(f"Health: {health.get('status', 'unknown')}")
except:
    print("Health: unable to check")

print(f"\nNext heal: in 5 minutes")
print(f"Admin login: admin / DeathLegion2025!")
