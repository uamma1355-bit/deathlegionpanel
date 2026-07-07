#!/usr/bin/env python3
"""Self-heal script: ensure unified Pterodactyl panel stays up on Daytona.
   This script is idempotent - safe to run every 5 minutes.
"""
import os, json, urllib.request, time

DAYTONA_TOKEN = os.environ.get('DAYTONA_TOKEN', 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22')
SANDBOX_ID = os.environ.get('SANDBOX_ID', '210e4afe-d6d5-4cc1-b3d3-05f40077ea15')
PUBLIC_HOST = '8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'
PUBLIC_URL = 'https://' + PUBLIC_HOST
PANEL_DIR = '/home/daytona/pterodactyl-panel'
DAYTONA_API = 'https://app.daytona.io/api'

def run(cmd, timeout=60):
    url = DAYTONA_API + '/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', '')
    except Exception as e:
        return f'ERR: {e}'

def check_public_url():
    """Check if panel is reachable via public URL."""
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
print(f"Public URL: {PUBLIC_URL}")
print()

# Step 1: Check public URL
print("=== Step 1: Check public URL ===")
public_ok = check_public_url()
print(f"Public URL reachable: {public_ok}")

# Step 2: Ensure MySQL is running
print("\n=== Step 2: Ensure MySQL running ===")
print(run("sudo service mariadb start 2>&1 || sudo service mysql start 2>&1 || (sudo mysqld_safe &); sleep 2; mysqladmin -u pterodactyl -pptero_app_pw_2025 ping 2>&1 | head -3"))

# Step 3: Ensure Redis is running
print("\n=== Step 3: Ensure Redis running ===")
print(run("redis-cli ping 2>&1 || (redis-server --daemonize yes && sleep 1 && redis-cli ping)"))

# Step 4: Ensure PHP server is running on port 8001
print("\n=== Step 4: Ensure PHP server on 8001 ===")
print(run("""if ! ss -tlnp | grep -q ':8001'; then
  cd """ + PANEL_DIR + """
  nohup php8.4 -S 0.0.0.0:8001 """ + PANEL_DIR + """/server.php > /tmp/php-server.log 2>&1 &
  disown
  sleep 3
fi
ss -tlnp | grep :8001 | head -1
echo "PHP_OK"
"""))

# Step 5: Ensure nginx is running on port 8000
print("\n=== Step 5: Ensure nginx on 8000 ===")
print(run("""if ! ss -tlnp | grep -q ':8000'; then
  sudo nginx 2>&1
  sleep 2
fi
ss -tlnp | grep :8000 | head -1
echo "NGINX_OK"
"""))

# Step 6: Ensure Wings is running
print("\n=== Step 6: Ensure Wings running ===")
print(run("""if ! pgrep -f 'wings --config' > /dev/null; then
  nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
  disown
  sleep 8
fi
ps aux | grep 'wings --config' | grep -v grep | head -1
echo "WINGS_OK"
"""))

# Step 7: Verify panel responds
print("\n=== Step 7: Verify panel responds ===")
print(run("""curl -s -o /dev/null -w 'HTTP:%{http_code}' http://127.0.0.1:8000/
echo
curl -s -o /dev/null -w 'HTTP:%{http_code}' http://127.0.0.1:8000/api/client/account
echo
"""))

# Step 8: Test login works
print("\n=== Step 8: Test login ===")
print(run("""# Get CSRF
curl -s -c /tmp/sh-cookies.txt -o /dev/null http://127.0.0.1:8000/sanctum/csrf-cookie
XSRF=$(grep XSRF-TOKEN /tmp/sh-cookies.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
SESSION=$(grep pterodactyl_session /tmp/sh-cookies.txt | awk '{print $7}')
# Login
curl -s -X POST http://127.0.0.1:8000/auth/login \\
  -H 'Content-Type: application/json' -H 'Accept: application/json' \\
  -H "X-XSRF-TOKEN: $XSRF" -H "Cookie: XSRF-TOKEN=$(grep XSRF-TOKEN /tmp/sh-cookies.txt | awk '{print $7}'); pterodactyl_session=$SESSION" \\
  -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{"user":"admin","password":"DeathLegion2025!"}' | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); print("login:", d.get("data",{}).get("complete","FAIL"))'
"""))

# Step 9: Final status
print("\n=== Step 9: Final status ===")
public_ok_final = check_public_url()
print(f"Public URL: {PUBLIC_URL}")
print(f"Status: {'HEALTHY' if public_ok_final else 'UNHEALTHY'}")
print(f"Admin login: admin / DeathLegion2025!")
print()
print("Services:")
print(run("""echo "PHP:    $(ss -tlnp | grep :8001 | head -1 | awk '{print $1}')"
echo "nginx:  $(ss -tlnp | grep :8000 | head -1 | awk '{print $1}')"
echo "Wings:  $(pgrep -f 'wings --config' > /dev/null && echo 'running' || echo 'NOT running')"
echo "MySQL:  $(mysqladmin -u pterodactyl -pptero_app_pw_2025 ping 2>&1 | head -1)"
echo "Redis:  $(redis-cli ping 2>&1)"
"""))
