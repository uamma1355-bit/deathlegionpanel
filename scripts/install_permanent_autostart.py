#!/usr/bin/env python3
"""Install a robust auto-start script that handles all the quirks we discovered."""
import json, urllib.request, time

DAYTONA_TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX_ID = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"
DAYTONA_API = "https://app.daytona.io/api"

def exec_cmd(command, timeout=120):
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

# Robust auto-start script (handles all the issues discovered)
autostart_script = r'''#!/bin/bash
# /opt/deathlegion/start_all.sh
# Permanent service starter for Death Legion Panel
# Starts: docker, mariadb, redis, php-fpm, nginx, wings
# Idempotent: safe to run multiple times
set -u
LOG=/var/log/deathlegion-start.log
mkdir -p /var/log
echo "===== $(date -u +%Y-%m-%dT%H:%M:%SZ) start_all.sh invoked =====" >> $LOG

# 1. Docker (needed by Wings to run server containers)
if ! docker info >/dev/null 2>&1; then
  echo "  starting docker..." >> $LOG
  service docker start >> $LOG 2>&1
  sleep 4
fi
docker info >/dev/null 2>&1 && echo "  docker: OK" >> $LOG || echo "  docker: FAILED" >> $LOG

# 2. MariaDB (Panel database)
if ! pgrep -x mariadbd >/dev/null 2>&1 && ! pgrep -x mysqld >/dev/null 2>&1; then
  echo "  starting mariadb..." >> $LOG
  service mariadb start >> $LOG 2>&1
  sleep 4
fi
pgrep -x mariadbd >/dev/null 2>&1 && echo "  mariadb: OK" >> $LOG || echo "  mariadb: FAILED" >> $LOG

# 3. Redis (Panel cache/queues)
if ! pgrep -x redis-server >/dev/null 2>&1; then
  echo "  starting redis..." >> $LOG
  service redis-server start >> $LOG 2>&1
  sleep 2
fi
pgrep -x redis-server >/dev/null 2>&1 && echo "  redis: OK" >> $LOG || echo "  redis: FAILED" >> $LOG

# 4. PHP-FPM (runs Panel Laravel app)
#    Note: binary is named php8.4 even though service is php8.2-fpm
if ! pgrep -f 'php-fpm' >/dev/null 2>&1 && ! pgrep -f 'php8.4' >/dev/null 2>&1; then
  echo "  starting php-fpm..." >> $LOG
  # Try multiple service names (version may vary)
  service php8.4-fpm start >> $LOG 2>&1
  service php8.2-fpm start >> $LOG 2>&1
  sleep 3
fi
pgrep -f 'php8' >/dev/null 2>&1 && echo "  php-fpm: OK" >> $LOG || echo "  php-fpm: FAILED" >> $LOG

# 5. nginx (public reverse proxy: 8000 -> php-fpm:8001 and wings:8080)
if ! pgrep -x nginx >/dev/null 2>&1; then
  echo "  starting nginx..." >> $LOG
  service nginx start >> $LOG 2>&1
  sleep 2
fi
pgrep -x nginx >/dev/null 2>&1 && echo "  nginx: OK" >> $LOG || echo "  nginx: FAILED" >> $LOG

# 6. Wings (daemon that runs game/bot servers via docker)
if ! pgrep -f '/usr/local/bin/wings' >/dev/null 2>&1; then
  echo "  starting wings..." >> $LOG
  # Use bash -c so the redirect is run as root inside sudo
  sudo bash -c 'nohup /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /var/log/wings-stdout.log 2>&1 &'
  sleep 8
fi
pgrep -f '/usr/local/bin/wings' >/dev/null 2>&1 && echo "  wings: OK" >> $LOG || echo "  wings: FAILED" >> $LOG

# 7. Wait for Wings to fully boot and start any auto-start servers
sleep 5
echo "===== $(date -u +%Y-%m-%dT%H:%M:%SZ) start_all.sh done =====" >> $LOG
echo "" >> $LOG
'''

# rc.local — runs on sandbox boot
rc_local = r'''#!/bin/bash
# /etc/rc.local — runs on sandbox boot
# Starts all Death Legion services
sleep 5
bash /opt/deathlegion/start_all.sh >> /var/log/deathlegion-boot.log 2>&1
exit 0
'''

# Install everything in one go
install_cmd = f"""cat > /tmp/start_all.sh << 'SCRIPTEOF'
{autostart_script}
SCRIPTEOF
cat > /tmp/rc_local << 'RCEOF'
{rc_local}
RCEOF
sudo mkdir -p /opt/deathlegion
sudo cp /tmp/start_all.sh /opt/deathlegion/start_all.sh
sudo chmod +x /opt/deathlegion/start_all.sh
sudo cp /tmp/rc_local /etc/rc.local
sudo chmod +x /etc/rc.local
# Also create a simple loop watcher that restarts Wings if it dies
cat > /tmp/wings_watcher.sh << 'WATCHEOF'
#!/bin/bash
# /opt/deathlegion/wings_watcher.sh
# Restarts Wings if it dies
while true; do
  if ! pgrep -f '/usr/local/bin/wings' >/dev/null 2>&1; then
    echo "[$(date -u)] Wings down, restarting..." >> /var/log/wings-watcher.log
    sudo bash -c 'nohup /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /var/log/wings-stdout.log 2>&1 &'
  fi
  sleep 60
done
WATCHEOF
sudo cp /tmp/wings_watcher.sh /opt/deathlegion/wings_watcher.sh
sudo chmod +x /opt/deathlegion/wings_watcher.sh
echo "=== Installed files ==="
ls -la /opt/deathlegion/ /etc/rc.local
echo "=== start_all.sh head ==="
head -10 /opt/deathlegion/start_all.sh
echo "=== /etc/rc.local ==="
cat /etc/rc.local"""

print(">>> Installing permanent auto-start scripts")
code, out, err = exec_cmd(install_cmd, timeout=60)
print(out)
if err: print("ERR:", err[:300])

# Start the wings watcher in the background (it will keep Wings alive forever)
print("\n>>> Starting wings watcher in background")
code, out, err = exec_cmd("sudo bash -c 'nohup bash /opt/deathlegion/wings_watcher.sh > /var/log/wings-watcher.log 2>&1 &' ; sleep 2 ; pgrep -f 'wings_watcher' && echo 'Watcher running' || echo 'Watcher NOT running'", timeout=30)
print(out)

# Test running the start_all.sh script
print("\n>>> Test run start_all.sh")
code, out, err = exec_cmd("bash /opt/deathlegion/start_all.sh 2>&1 ; echo '---' ; cat /var/log/deathlegion-start.log | tail -20", timeout=60)
print(out)

# Final verification
print("\n>>> Final state")
code, out, err = exec_cmd("ps -eo pid,comm | grep -E 'wings|nginx|redis|mariadbd|docker|php' | sort -k2 | uniq", timeout=30)
print(out)
