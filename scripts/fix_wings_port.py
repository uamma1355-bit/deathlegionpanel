#!/usr/bin/env python3
"""Fix Wings port mismatch and verify everything."""
import json, urllib.request, time

DAYTONA_TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX_ID = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"
DAYTONA_API = "https://app.daytona.io/api"

def exec_cmd(command, timeout=180):
    body = {"command": command, "cwd": "/home/daytona", "timeout": timeout}
    req = urllib.request.Request(
        f"{DAYTONA_API}/toolbox/{SANDBOX_ID}/toolbox/process/execute",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {DAYTONA_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout + 30) as resp:
            result = json.loads(resp.read())
            return int(result.get("exitCode", -1)), result.get("result", ""), result.get("error", "")
    except Exception as e:
        return -1, "", str(e)

def run(label, cmd, timeout=180):
    print(f"\n>>> {label}")
    code, out, err = exec_cmd(cmd, timeout=timeout)
    if out:
        print("    " + out[:2000].replace("\n", "\n    "))
    if err and len(err) < 500:
        print("    ERR: " + err)
    return code, out, err

# Fix Wings config.yml to listen on 8080 (matches nginx routing)
new_wings_config = '''debug: false
app_name: Pterodactyl
uuid: c3c6f2f4-7abf-11f1-8bac-6efba8ae1f21
token_id: OHGxjZ1rBPTaY1ve
token: 6N5Ftn567Geq7fvElkLjsjiTSfcCd23HxMRId9ng
api:
  host: 127.0.0.1
  port: 8080
  ssl:
    enabled: false
    cert: ""
    key: ""
  disable_remote_download: false
  upload_limit: 100
  trusted_proxies: []
system:
  root_directory: /var/lib/pterodactyl
  log_directory: /var/log/pterodactyl
  data: /var/lib/pterodactyl/volumes
  archive_directory: /var/lib/pterodactyl/archives
  backup_directory: /var/lib/pterodactyl/backups
  tmp_directory: /tmp/pterodactyl
  username: pterodactyl
  timezone: UTC
  user:
    rootless:
      enabled: false
      container_uid: 0
      container_gid: 0
    uid: 999
    gid: 986
  disk_check_interval: 150
  activity_send_interval: 60
  activity_send_count: 100
  check_permissions_on_boot: true
  enable_log_rotate: true
  websocket_log_count: 150
  sftp:
    bind_address: 0.0.0.0
    bind_port: 2022
    read_only: false
  crash_detection:
    enabled: true
    detect_clean_exit_as_crash: true
    timeout: 60
  backups:
    write_limit: 0
    compression_level: best_speed
  transfers:
    download_limit: 0
'''

# Write new Wings config
write_cfg = f"""cat > /tmp/wings_config.yml << 'CFGEOF'
{new_wings_config}
CFGEOF
sudo cp /tmp/wings_config.yml /etc/pterodactyl/config.yml
sudo chown root:root /etc/pterodactyl/config.yml
sudo chmod 600 /etc/pterodactyl/config.yml
echo "Wings config written:"
sudo head -10 /etc/pterodactyl/config.yml"""
run("Write new Wings config (port 8080)", write_cfg)

# Kill Wings and restart
run("Kill Wings", "sudo pkill -f '/usr/local/bin/wings' ; sleep 2 ; pgrep -f '/usr/local/bin/wings' || echo 'Wings stopped'")

# Start Wings with proper redirect
run(
    "Start Wings",
    "sudo bash -c 'nohup /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /var/log/wings-stdout.log 2>&1 &' ; sleep 8 ; pgrep -f '/usr/local/bin/wings' && echo 'Wings running' || echo 'Wings NOT running'",
)

# Verify ports
print("\n>>> Port verification")
run("Listening ports", "sudo ss -tlnp 2>&1 | grep -E ':8080|:443|:8000|:2022' | head -10")

# Wait for Wings to fully boot
print("\n>>> Waiting 15s for Wings to fully boot and contact Panel...")
time.sleep(15)

# Test endpoints
print("\n>>> Endpoint tests (after fix)")
run("Local Wings (8080)", "curl -sk -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\\n' http://127.0.0.1:8080/api/system")
run("Via nginx (8000)", "curl -sk -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\\n' -A 'Mozilla/5.0' http://127.0.0.1:8000/api/system")
run("Via Daytona URL", "curl -sk -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\\n' -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/system")
run("Via Vercel", "curl -sk -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\\n' -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' https://deathlegionpanel.vercel.app/api/system")

# Wings log
print("\n>>> Wings log (last 30)")
run("Wings log", "sudo tail -30 /var/log/pterodactyl/wings.log 2>&1")
