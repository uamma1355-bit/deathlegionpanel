#!/usr/bin/env python3
"""Fix Wings to use LOCAL Panel URL (127.0.0.1:8000) since the sandbox can't reach its own public URL."""
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
        print("    " + out[:3000].replace("\n", "\n    "))
    if err and len(err) < 500:
        print("    ERR: " + err)
    return code, out, err

# Test if local Panel URL works
print(">>> Test local Panel URL reachability")
run("Test 127.0.0.1:8000", "curl -s -o /dev/null -w 'HTTP %{http_code}\\n' -k http://127.0.0.1:8000/")

# Update Wings config to use local URL
PANEL_URL_LOCAL = "http://127.0.0.1:8000"

new_wings_config = f'''debug: false
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
    detect_clean_exit_as_crash: false
    timeout: 60
  backups:
    write_limit: 0
    compression_level: best_speed
  transfers:
    download_limit: 0
remote: {PANEL_URL_LOCAL}
allowed_origins: []
'''

write_cfg = f"""cat > /tmp/wings_config.yml << 'CFGEOF'
{new_wings_config}
CFGEOF
sudo cp /tmp/wings_config.yml /etc/pterodactyl/config.yml
sudo chown root:root /etc/pterodactyl/config.yml
sudo chmod 600 /etc/pterodactyl/config.yml
echo "Wings config updated:"
sudo grep -E '^(remote|api|  host|  port):' /etc/pterodactyl/config.yml"""
run("Update Wings config with local URL", write_cfg)

# Also update Panel's APP_URL to be the local URL so it generates correct websocket endpoints for internal use
# BUT keep Panel's APP_URL public so users can access it from browsers
# Actually, APP_URL is what the Panel uses to generate URLs for BOTH users AND wings config
# So we can't just change APP_URL — we need to keep it as the public URL
# The Wings config remote: is a SEPARATE thing — it's where Wings sends its API calls

# Fix server images — update all servers to use a valid docker image
# The egg has: {"Nodejs 24":"ghcr.io/ptero-eggs/yolks:nodejs_24", ...}
# Old server image: "ghcr.io/pterodactyl/yolks:node_18" (doesn't exist)
# New: "ghcr.io/ptero-eggs/yolks:nodejs_24"
print("\n>>> Fix server images")
run(
    "Check current server images",
    """mysql -u pterodactyl -p'ptero_app_pw_2025' pterodactyl -e "SELECT id, name, image FROM servers LIMIT 25;" 2>&1""",
)
run(
    "Update all user server images to nodejs_24",
    """mysql -u pterodactyl -p'ptero_app_pw_2025' pterodactyl -e "UPDATE servers SET image='ghcr.io/ptero-eggs/yolks:nodejs_24' WHERE egg_id=1;" 2>&1""",
)
run(
    "Verify images",
    """mysql -u pterodactyl -p'ptero_app_pw_2025' pterodactyl -e "SELECT id, name, image FROM servers WHERE egg_id=1 LIMIT 5;" 2>&1""",
)

# Kill Wings and restart
run("Kill Wings", "sudo pkill -f '/usr/local/bin/wings' ; sleep 3 ; pgrep -f '/usr/local/bin/wings' || echo 'Wings stopped'")

# Start Wings
run(
    "Start Wings",
    "sudo bash -c 'nohup /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /var/log/wings-stdout.log 2>&1 &' ; sleep 10 ; pgrep -f '/usr/local/bin/wings' && echo 'Wings running' || echo 'Wings NOT running'",
)

# Wait
print("\n>>> Waiting 20s for Wings to fetch servers from Panel (local URL)...")
time.sleep(20)

# Check log
print("\n>>> Wings stdout (last 25)")
run("Wings stdout", "sudo tail -25 /var/log/wings-stdout.log 2>&1")

print("\n>>> Wings log (last 15)")
run("Wings log", "sudo tail -15 /var/log/pterodactyl/wings.log 2>&1")

# Check listening ports
print("\n>>> Listening ports")
run("Ports", "sudo ss -tlnp 2>&1 | grep -E ':8080|:2022' | head -5")

# Test endpoints with proper escaping
print("\n>>> Endpoint tests")
run("Local Wings (8080)", """curl -sk -o /dev/null -w 'HTTP %{http_code}\\n' http://127.0.0.1:8080/api/system""")
run("Via nginx (8000)", """curl -sk -o /dev/null -w 'HTTP %{http_code}\\n' -A 'Mozilla/5.0' http://127.0.0.1:8000/api/system""")
run("Via Daytona URL", """curl -sk -o /dev/null -w 'HTTP %{http_code}\\n' -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/system""")
run("Via Vercel", """curl -sk -o /dev/null -w 'HTTP %{http_code}\\n' -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' https://deathlegionpanel.vercel.app/api/system""")
