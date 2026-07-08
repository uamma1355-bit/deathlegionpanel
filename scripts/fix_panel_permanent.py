#!/usr/bin/env python3
"""
DEATH LEGION - PERMANENT FIX SCRIPT
====================================
Fixes:
1. Panel node fqdn -> Daytona URL (so WebSocket works, not Vercel)
2. Deploys a working Baileys bot template to ALL user servers
3. Sets up auto-start for all services on sandbox boot
4. Restarts Wings to apply changes
5. Verifies everything works
"""
import json
import urllib.request
import urllib.error
import time
import sys

DAYTONA_TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX_ID = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"
DAYTONA_API = "https://app.daytona.io/api"

PUBLIC_URL_HOST = "8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu"

def exec_cmd(command, timeout=300):
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


def run(label, cmd, timeout=300, fatal=False):
    print(f"\n>>> {label}")
    print(f"    $ {cmd[:200]}")
    code, out, err = exec_cmd(cmd, timeout=timeout)
    if out:
        print("    " + out[:1500].replace("\n", "\n    "))
    if err:
        print("    ERR: " + err[:500])
    if fatal and code != 0:
        print(f"!!! FATAL: {label} failed (exit {code})")
        sys.exit(1)
    return code, out, err


# Baileys bot template — a real, working WhatsApp bot skeleton
BAILEYS_BOT_TEMPLATE = r"""'use strict';
// Death Legion - WhatsApp Baileys Bot Skeleton (permanent, auto-reconnect)
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const SESSION_DIR = process.env.SESSION_DIR || './session';
const OWNER = process.env.OWNER || 'unknown';
const SERVER_NAME = process.env.SERVER_NAME || 'DeathLegion Bot';

fs.mkdirSync(SESSION_DIR, { recursive: true });

const logger = pino({ level: 'silent' });

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ['Death Legion', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\n[QR] Scan this QR code with your WhatsApp:');
      console.log(qr);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`[conn] closed (code=${code}); reconnect=${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startSock, 3000);
      }
    } else if (connection === 'open') {
      console.log(`[conn] OPEN — ${SERVER_NAME} (owner=${OWNER}) is online`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      if (!m.message) continue;
      const from = m.key.remoteJid;
      const text = m.message.conversation ||
                   m.message.extendedTextMessage?.text || '';
      if (!text) continue;
      console.log(`[msg] ${from}: ${text}`);
      const lower = text.toLowerCase();
      if (lower === '!ping') {
        await sock.sendMessage(from, { text: 'pong — Death Legion bot alive' });
      } else if (lower === '!owner') {
        await sock.sendMessage(from, { text: `Owner: ${OWNER}` });
      } else if (lower === '!help') {
        await sock.sendMessage(from, { text: 'Commands: !ping, !owner, !help' });
      }
    }
  });

  return sock;
}

process.on('unhandledRejection', (e) => console.error('[unhandled]', e.message));
process.on('uncaughtException', (e) => console.error('[uncaught]', e.message));

startSock().catch(e => {
  console.error('[fatal]', e);
  process.exit(1);
});
"""

PACKAGE_JSON = r"""{
  "name": "deathlegion-bot",
  "version": "1.0.0",
  "private": true,
  "description": "Death Legion WhatsApp Baileys bot",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.0",
    "pino": "^9.0.0",
    "qrcode-terminal": "^0.12.0"
  }
}
"""

print("=" * 70)
print("DEATH LEGION — PERMANENT FIX SCRIPT")
print("=" * 70)

# ============================================================
# STEP 1: Fix Panel node fqdn -> Daytona URL
# ============================================================
print("\n[STEP 1] Fixing Panel node fqdn -> Daytona public URL")
print(f"         (so WebSocket console can bypass Vercel)")
run(
    "Update node fqdn/daemonListen/scheme",
    f"""mysql -u pterodactyl -p'ptero_app_pw_2025' pterodactyl -e "UPDATE nodes SET fqdn='{PUBLIC_URL_HOST}', scheme='https', daemonListen=443, daemonSFTP=2022, behind_proxy=1 WHERE id=1;" 2>&1""",
)
run(
    "Verify node config",
    f"""mysql -u pterodactyl -p'ptero_app_pw_2025' pterodactyl -e "SELECT id, name, fqdn, scheme, daemonListen, daemonSFTP, behind_proxy FROM nodes\\G" 2>&1""",
)

# ============================================================
# STEP 2: Deploy Baileys bot template to all user servers
# ============================================================
print("\n[STEP 2] Deploying Baileys bot template to all user servers")

# Get list of server UUIDs
code, out, err = exec_cmd("""mysql -u pterodactyl -p'ptero_app_pw_2025' pterodactyl -N -e "SELECT uuid FROM servers WHERE owner_id != 1 ORDER BY id;" 2>&1""")
server_uuids = [line.strip() for line in out.strip().split("\n") if line.strip() and len(line.strip()) == 36]
print(f"    Found {len(server_uuids)} user servers: {server_uuids}")

# Write template files to a temp location
template_cmd = f"""cat > /tmp/bot_template_index.js << 'BOTEOF'
{BAILEYS_BOT_TEMPLATE}
BOTEOF
cat > /tmp/bot_template_package.json << 'PKGEOF'
{PACKAGE_JSON}
PKGEOF
echo "Template files written"
ls -la /tmp/bot_template_*"""
run("Write bot template files", template_cmd)

# Deploy to each server's volume
for uuid in server_uuids:
    vol = f"/var/lib/pterodactyl/volumes/{uuid}"
    deploy_cmd = (
        f"sudo mkdir -p {vol} && "
        f"sudo cp /tmp/bot_template_index.js {vol}/index.js && "
        f"sudo cp /tmp/bot_template_package.json {vol}/package.json && "
        f"sudo chown -R pterodactyl:pterodactyl {vol} && "
        f"sudo ls -la {vol}/ && "
        f"echo 'Deployed to {uuid}'"
    )
    run(f"Deploy to {uuid[:8]}...", deploy_cmd)

# ============================================================
# STEP 3: Set up auto-start script for all services
# ============================================================
print("\n[STEP 3] Creating permanent auto-start script")

# This script will be called by Daytona's boot hooks AND by self-heal
autostart_script = r"""#!/bin/bash
# /opt/deathlegion/start_all.sh — Permanent service starter
# Starts: docker, mariadb, redis, php-fpm, nginx, wings
set -u
LOG=/var/log/deathlegion-start.log
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] start_all.sh invoked" >> $LOG

# 1. Docker
if ! docker info >/dev/null 2>&1; then
  echo "  starting docker..."
  service docker start 2>&1 >> $LOG
  sleep 3
fi
docker info >/dev/null 2>&1 && echo "  docker: OK" >> $LOG || echo "  docker: FAILED" >> $LOG

# 2. MariaDB
if ! pgrep -x mysqld >/dev/null; then
  echo "  starting mariadb..."
  service mariadb start 2>&1 >> $LOG
  sleep 3
fi
pgrep -x mysqld >/dev/null && echo "  mariadb: OK" >> $LOG || echo "  mariadb: FAILED" >> $LOG

# 3. Redis
if ! pgrep -x redis-server >/dev/null; then
  echo "  starting redis..."
  service redis-server start 2>&1 >> $LOG
  sleep 2
fi
pgrep -x redis-server >/dev/null && echo "  redis: OK" >> $LOG || echo "  redis: FAILED" >> $LOG

# 4. PHP-FPM
if ! pgrep -x php8.4-fpm >/dev/null && ! pgrep -f 'php-fpm' >/dev/null; then
  echo "  starting php-fpm..."
  service php8.2-fpm start 2>&1 >> $LOG
  service php8.4-fpm start 2>&1 >> $LOG
  sleep 2
fi
pgrep -f 'php-fpm' >/dev/null && echo "  php-fpm: OK" >> $LOG || echo "  php-fpm: FAILED" >> $LOG

# 5. nginx
if ! pgrep -x nginx >/dev/null; then
  echo "  starting nginx..."
  service nginx start 2>&1 >> $LOG
  sleep 2
fi
pgrep -x nginx >/dev/null && echo "  nginx: OK" >> $LOG || echo "  nginx: FAILED" >> $LOG

# 6. Wings (run via sudo setsid, exactly like current)
if ! pgrep -f '/usr/local/bin/wings' >/dev/null; then
  echo "  starting wings..."
  sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /var/log/wings-stdout.log 2>&1 &
  sleep 5
fi
pgrep -f '/usr/local/bin/wings' >/dev/null && echo "  wings: OK" >> $LOG || echo "  wings: FAILED" >> $LOG

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] start_all.sh done" >> $LOG
"""
write_script_cmd = f"""cat > /opt/deathlegion/start_all.sh << 'SCRIPTEOF'
{autostart_script}
SCRIPTEOF
sudo mkdir -p /opt/deathlegion
sudo mv /opt/deathlegion/start_all.sh /opt/deathlegion/start_all.sh 2>/dev/null || true
cat > /tmp/start_all.sh << 'SCRIPTEOF'
{autostart_script}
SCRIPTEOF
sudo mkdir -p /opt/deathlegion
sudo cp /tmp/start_all.sh /opt/deathlegion/start_all.sh
sudo chmod +x /opt/deathlegion/start_all.sh
ls -la /opt/deathlegion/start_all.sh
echo "Auto-start script installed"""
run("Install auto-start script", write_script_cmd)

# Install boot hook — runs on every sandbox boot via /etc/rc.local
boot_hook_cmd = r"""cat > /tmp/rc_local << 'RCEOF'
#!/bin/bash
# /etc/rc.local — runs on sandbox boot
sleep 5
bash /opt/deathlegion/start_all.sh &
exit 0
RCEOF
sudo cp /tmp/rc_local /etc/rc.local
sudo chmod +x /etc/rc.local
# Also install as a cron @reboot for redundancy
( sudo crontab -l 2>/dev/null | grep -v 'start_all.sh' ; echo '@reboot sleep 10 && bash /opt/deathlegion/start_all.sh >/var/log/deathlegion-boot.log 2>&1' ) | sudo tee /etc/cron.d/deathlegion-boot > /dev/null
sudo chmod 0644 /etc/cron.d/deathlegion-boot
# Also add to root crontab
( sudo crontab -l 2>/dev/null | grep -v 'start_all.sh' ; echo '@reboot sleep 10 && bash /opt/deathlegion/start_all.sh >/var/log/deathlegion-boot.log 2>&1' ) | sudo crontab -
echo "Boot hook installed"
sudo crontab -l
ls -la /etc/rc.local"""
run("Install boot hooks", boot_hook_cmd)

# ============================================================
# STEP 4: Restart Wings to pick up new config (and clear stale state)
# ============================================================
print("\n[STEP 4] Restarting Wings to apply new config")
run(
    "Kill existing Wings",
    "sudo pkill -f '/usr/local/bin/wings' ; sleep 2 ; pgrep -f '/usr/local/bin/wings' || echo 'Wings killed'",
)
run(
    "Start Wings fresh",
    "sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /var/log/wings-stdout.log 2>&1 & sleep 5 ; pgrep -f '/usr/local/bin/wings' && echo 'Wings running'",
)
run(
    "Wings log (last 30 lines)",
    "sudo tail -30 /var/log/pterodactyl/wings.log 2>&1",
)

# ============================================================
# STEP 5: Verify Panel ↔ Wings connectivity
# ============================================================
print("\n[STEP 5] Verifying Panel <-> Wings connectivity")

# Direct local test
run(
    "Local Wings test (127.0.0.1:8080)",
    "curl -sk -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\\n' http://127.0.0.1:8080/api/system",
)

# Via nginx (port 8000)
run(
    "Via nginx (port 8000)",
    "curl -sk -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\\n' -A 'Mozilla/5.0' https://127.0.0.1:8000/api/system",
)

# Via public URL
run(
    "Via public Daytona URL",
    f"curl -sk -o /dev/null -w 'HTTP %{{http_code}} (%{{time_total}}s)\\n' -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' https://{PUBLIC_URL_HOST}/api/system",
)

# Via Vercel
run(
    "Via Vercel",
    "curl -sk -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\\n' -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' https://deathlegionpanel.vercel.app/api/system",
)

print("\n" + "=" * 70)
print("FIX COMPLETE — checking final state")
print("=" * 70)

run(
    "Final service status",
    "ps aux | grep -E 'wings|mysqld|redis|nginx|php-fpm' | grep -v grep | awk '{print $11}' | sort -u",
)
run(
    "Disk space",
    "df -h / | tail -1",
)
run(
    "Final node config",
    f"""mysql -u pterodactyl -p'ptero_app_pw_2025' pterodactyl -e "SELECT id, name, fqdn, scheme, daemonListen FROM nodes\\G" 2>&1""",
)

print("\nDone. Verify the panel UI now loads the server console.")
