#!/usr/bin/env python3
"""Install Docker watcher, storage manager, and update start_all.sh permanently."""
import json, urllib.request, base64, subprocess, os, time

DT = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SB = "16551277-c744-47d8-bbf4-f681442b1691"
E2B_KEY = "e2b_1f9efe2fb912240566b001e41fcfc5a7b786f8e3"

def cmd(c, t=10):
    body = json.dumps({"command": c, "cwd": "/home/daytona", "timeout": t}).encode()
    req = urllib.request.Request(
        f"https://app.daytona.io/api/toolbox/{SB}/toolbox/process/execute",
        data=body,
        headers={"Authorization": f"Bearer {DT}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=t+10) as resp:
            return json.loads(resp.read()).get("result", "").strip()
    except:
        return "TIMEOUT"

def upload_file(path, content):
    b64 = base64.b64encode(content.encode()).decode()
    return cmd(f"echo '{b64}' | base64 -d | sudo tee {path} > /dev/null && sudo chmod +x {path} && echo OK")

# ============================================================
# 1. Install Docker watcher
# ============================================================
print("=== 1. Docker watcher ===")
docker_watcher = """#!/bin/bash
# /opt/deathlegion/docker_watcher.sh
# Restarts Docker if it dies, pulls image if missing
while true; do
  if ! sudo docker info > /dev/null 2>&1; then
    echo "[$(date -u)] Docker down, restarting..." >> /var/log/docker-watcher.log
    sudo pkill -9 dockerd 2>/dev/null
    sudo pkill -9 containerd 2>/dev/null
    sleep 3
    sudo rm -rf /var/lib/docker/containerd 2>/dev/null
    sudo bash -c 'nohup dockerd > /tmp/dockerd.log 2>&1 &'
    sleep 10
    if ! sudo docker images | grep -q parkervcp/yolks; then
      sudo docker pull ghcr.io/parkervcp/yolks:nodejs_18 >> /tmp/docker-pull.log 2>&1
    fi
    # Restart Wings
    sudo pkill -f '/usr/local/bin/wings' 2>/dev/null
    sleep 2
    for i in 1 2 3 4 5; do
      sudo bash -c "nohup /usr/local/bin/wings --config /etc/pterodactyl/config${i}.yml > /var/log/wings-${i}.log 2>&1 &"
      sleep 1
    done
  fi
  sleep 30
done
"""
print(upload_file("/opt/deathlegion/docker_watcher.sh", docker_watcher))

# Start the watcher
cmd("sudo bash -c 'nohup bash /opt/deathlegion/docker_watcher.sh > /var/log/docker-watcher.log 2>&1 &' &")
print("Docker watcher started (background)")

# ============================================================
# 2. Install storage cleaner (runs every 5 min)
# ============================================================
print("\n=== 2. Storage cleaner ===")
storage_cleaner = """#!/bin/bash
# /opt/deathlegion/storage_cleaner.sh
# Runs every 5 min — keeps disk under 70%
while true; do
  FREE_PCT=$(df / | tail -1 | awk '{print int($5)}')
  if [ "$FREE_PCT" -gt 70 ]; then
    echo "[$(date -u)] Disk at ${FREE_PCT}%, cleaning..." >> /var/log/storage-cleaner.log
    # Remove node_modules from bot volumes
    for dir in /var/lib/pterodactyl/volumes/*/; do
      sudo rm -rf "$dir/node_modules" "$dir/.npm" "$dir/.cache" "$dir/session" 2>/dev/null
    done
    # Clean logs
    sudo truncate -s 0 /var/log/nginx/access.log /var/log/nginx/error.log 2>/dev/null
    sudo truncate -s 0 /var/log/wings-*.log /var/log/wings-stdout.log 2>/dev/null
    # Clean tmp
    sudo rm -rf /tmp/*.log /tmp/*.txt /tmp/*.json /tmp/*.php /tmp/*.gz 2>/dev/null
    # Docker prune
    sudo docker container prune -f 2>/dev/null
    sudo docker image prune -f 2>/dev/null
    sync
    echo "[$(date -u)] Cleanup done: $(df / | tail -1 | awk '{print $5}')" >> /var/log/storage-cleaner.log
  fi
  sleep 300
done
"""
print(upload_file("/opt/deathlegion/storage_cleaner.sh", storage_cleaner))
cmd("sudo bash -c 'nohup bash /opt/deathlegion/storage_cleaner.sh > /var/log/storage-cleaner.log 2>&1 &' &")
print("Storage cleaner started (background)")

# ============================================================
# 3. Create E2B sandboxes for off-sandbox storage (110GB)
# ============================================================
print("\n=== 3. E2B storage (110GB) ===")
os.environ['E2B_API_KEY'] = E2B_KEY
result = subprocess.run(['node', '-e', '''
const { Sandbox } = require("e2b");
async function main() {
    const list = await Sandbox.list();
    console.log("Existing: " + list.length);
    if (list.length < 5) {
        // Kill old ones
        for (const s of list) { try { await Sandbox.kill(s.sandboxId); } catch {} }
        // Create 5 fresh
        for (let i = 0; i < 5; i++) {
            const sbx = await Sandbox.create({ timeoutMs: 3600000 });
            await sbx.commands.run("mkdir -p /home/user/storage/volumes /home/user/storage/backups /home/user/storage/mysql");
            console.log("Created: " + sbx.sandboxId);
        }
    } else {
        console.log("Reusing existing sandboxes");
    }
}
main().catch(e => console.error(e.message));
'''], capture_output=True, text=True, timeout=120, cwd='/tmp')
print(result.stdout.strip())
if result.stderr.strip(): print("  " + result.stderr.strip()[:200])

# ============================================================
# 4. Backup MySQL to E2B via Vercel proxy
# ============================================================
print("\n=== 4. MySQL backup to E2B ===")
# Dump MySQL
dump_result = cmd("mysqldump -u pterodactyl -pptero_app_pw_2025 pterodactyl 2>/dev/null | gzip > /tmp/db.sql.gz && wc -c /tmp/db.sql.gz")
print(f"  Dump: {dump_result}")

# Read and upload
b64_dump = cmd("base64 /tmp/db.sql.gz 2>/dev/null")
if b64_dump and b64_dump != "TIMEOUT" and len(b64_dump) > 50:
    try:
        dump_bytes = base64.b64decode(b64_dump.strip())
        req = urllib.request.Request(
            "https://deathlegionpanel.vercel.app/api/e2b-storage?action=backup-mysql",
            data=dump_bytes,
            headers={"Content-Type": "application/octet-stream"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            result = json.loads(r.read().decode())
            print(f"  E2B backup: {result.get('ok', False)} ({result.get('size', 0)} bytes)")
    except Exception as e:
        print(f"  E2B backup failed: {e}")

# ============================================================
# 5. Verify
# ============================================================
print("\n=== 5. Verify ===")
time.sleep(15)  # Wait for Docker watcher to restart Docker
print("Docker:", cmd("sudo docker info > /dev/null 2>&1 && echo OK || echo STARTING"))
print("Wings:", cmd("ps -eo args | grep 'wings --config' | grep -v grep | wc -l"))
print("Panel:", cmd("curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:8000/"))
print("Disk:", cmd("df -h / | tail -1"))
print("Watchers:", cmd("pgrep -f 'docker_watcher|storage_cleaner|php_watcher|wings_watcher' | wc -l"))
