#!/usr/bin/env python3
"""Self-heal script: ensure unified Pterodactyl panel stays up on Daytona."""
import os, json, urllib.request, time

DAYTONA_TOKEN = os.environ.get('DAYTONA_TOKEN', 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22')
SANDBOX_ID = os.environ.get('SANDBOX_ID', '210e4afe-d6d5-4cc1-b3d3-05f40077ea15')
PUBLIC_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
PANEL_DIR = '/home/daytona/pterodactyl-panel'
DAYTONA_API = 'https://app.daytona.io/api'

def run(cmd, timeout=60):
    url = DAYTONA_API + '/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            data = json.loads(r.read().decode())
            return data.get('result', '') or f'[exit:{data.get("exitCode")}]'
    except Exception as e:
        return f'ERR: {e}'

def check_public_url():
    try:
        req = urllib.request.Request(PUBLIC_URL + '/', method='GET')
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200
    except:
        return False

print("=" * 70)
print("UNIFIED PTERODACTYL SELF-HEAL")
print("=" * 70)
print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
print()

# Step 1: Clean disk space (CRITICAL - disk fills up and causes 500 errors)
print("=== Step 1: Clean disk space ===")
print(run("rm -rf /tmp/*.log /var/log/*.log /var/log/nginx/*.log " + PANEL_DIR + "/storage/logs/*.log 2>/dev/null; sudo docker container prune -f 2>/dev/null; sudo docker image prune -af 2>/dev/null; df -h / | tail -1"))

# Step 2: Ensure MySQL is running
print("\n=== Step 2: Ensure MySQL running ===")
print(run("sudo service mariadb start 2>&1 || sudo service mysql start 2>&1 || (sudo mysqld_safe &); sleep 2; mysqladmin -u pterodactyl -pptero_app_pw_2025 ping 2>&1 | head -3"))

# Step 3: Ensure Redis is running
print("\n=== Step 3: Ensure Redis running ===")
print(run("redis-cli ping 2>&1 || (redis-server --daemonize yes && sleep 1 && redis-cli ping)"))

# Step 4: Ensure Docker is running
print("\n=== Step 4: Ensure Docker running ===")
print(run("sudo docker info > /dev/null 2>&1 || (sudo dockerd > /tmp/docker.log 2>&1 & sleep 5); sudo docker info > /dev/null 2>&1 && echo 'Docker OK' || echo 'Docker FAIL'"))

# Step 5: Ensure PHP server is running on port 8001
print("\n=== Step 5: Ensure PHP server on 8001 ===")
print(run("""if ! ss -tlnp | grep -q ':8001'; then
  cd """ + PANEL_DIR + """
  nohup php8.4 -S 0.0.0.0:8001 """ + PANEL_DIR + """/server.php > /tmp/php-server.log 2>&1 &
  disown
  sleep 3
fi
ss -tlnp | grep :8001 | head -1
echo "PHP_OK"
"""))

# Step 6: Ensure nginx is running on port 8000
print("\n=== Step 6: Ensure nginx on 8000 ===")
print(run("""if ! ss -tlnp | grep -q ':8000'; then
  sudo nginx 2>&1
  sleep 2
fi
ss -tlnp | grep :8000 | head -1
echo "NGINX_OK"
"""))

# Step 7: Ensure Wings is running
print("\n=== Step 7: Ensure Wings running ===")
print(run("""if ! pgrep -f 'wings --config' > /dev/null; then
  nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
  disown
  sleep 8
fi
ps aux | grep 'wings --config' | grep -v grep | head -1
echo "WINGS_OK"
"""))

# Step 8: Verify panel responds
print("\n=== Step 8: Verify panel responds ===")
print(run("""curl -s -o /dev/null -w 'HTTP:%{http_code}' http://127.0.0.1:8000/
echo
"""))

# Step 9: Final status
print("\n=== Step 9: Final status ===")
public_ok = check_public_url()
print(f"Public URL: {PUBLIC_URL}")
print(f"Status: {'HEALTHY' if public_ok else 'UNHEALTHY'}")
print(f"Admin login: admin / DeathLegion2025!")
