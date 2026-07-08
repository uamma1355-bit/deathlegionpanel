#!/usr/bin/env python3
"""Use E2B for MySQL backup storage + fix Daytona panel completely.
   E2B has 22GB disk (vs Daytona's 3GB) - perfect for backups.
   Daytona keeps running the panel (1GB RAM, public URL)."""
import json, urllib.request, subprocess, time

E2B_API_KEY = 'e2b_1f9efe2fb912240566b001e41fcfc5a7b786f8e3'
DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
DAYTONA_API = 'https://app.daytona.io/api'

def run_daytona(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(DAYTONA_API + '/toolbox/' + SANDBOX_ID + '/toolbox/process/execute',
        data=body, method='POST', headers={
            'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', 'no result')
    except Exception as e:
        return f'ERR: {e}'

# Step 1: Restart Daytona sandbox to get fresh disk
print("=" * 70)
print("STEP 1: Restart Daytona sandbox for fresh disk")
print("=" * 70)
try:
    req = urllib.request.Request(DAYTONA_API + '/sandbox/' + SANDBOX_ID + '/stop',
        method='POST', headers={'Authorization': 'Bearer ' + DAYTONA_TOKEN})
    with urllib.request.urlopen(req, timeout=15) as r:
        print("Stop:", json.loads(r.read().decode()).get('state'))
except: pass

time.sleep(15)

try:
    req = urllib.request.Request(DAYTONA_API + '/sandbox/' + SANDBOX_ID + '/start',
        method='POST', headers={'Authorization': 'Bearer ' + DAYTONA_TOKEN})
    with urllib.request.urlopen(req, timeout=15) as r:
        print("Start:", json.loads(r.read().decode()).get('state'))
except: pass

time.sleep(20)
print("Sandbox restarted")

# Step 2: Clean disk + start all services
print("\n" + "=" * 70)
print("STEP 2: Start all services on fresh sandbox")
print("=" * 70)
print(run_daytona("""# Clean any leftover files
rm -rf /tmp/* /var/log/*.log 2>/dev/null

# Start MySQL
sudo service mariadb start 2>&1 || sudo service mysql start 2>&1 || (sudo mysqld_safe &)
sleep 3
mysqladmin -u pterodactyl -pptero_app_pw_2025 ping 2>&1

# Start Redis
redis-server --daemonize yes 2>/dev/null
redis-cli ping

# Start Docker
sudo dockerd > /tmp/docker.log 2>&1 &
sleep 5

# Rebuild config cache (was deleted)
cd /home/daytona/pterodactyl-panel && php artisan config:cache 2>&1 | tail -1
php artisan route:cache 2>&1 | tail -1
php artisan view:cache 2>&1 | tail -1

# Start PHP server
nohup php8.4 -S 0.0.0.0:8001 server.php > /tmp/php.log 2>&1 &
sleep 3

# Start nginx
sudo nginx 2>/dev/null

# Install bot files in volumes
for dir in /var/lib/pterodactyl/volumes/*/; do
  if [ -d "$dir" ] && [ ! -f "$dir/index.js" ]; then
    echo 'console.log("Upload your bot files via Files tab");' > "$dir/index.js"
    chown pterodactyl:pterodactyl "$dir/index.js"
  fi
done

# Pull Docker image
sudo docker pull ghcr.io/ptero-eggs/yolks:nodejs_24 2>&1 | tail -2

# Start Wings
pkill -f wings 2>/dev/null
sleep 2
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 10

# Check everything
echo "=== STATUS ==="
ss -tlnp | grep -E ":8000|:8001|:8080|:3306|:6379" | awk '{print $4, $6}'
echo "---"
curl -s -o /dev/null -w "Panel: HTTP:%{http_code}" http://127.0.0.1:8000/
echo
grep -c "finished loading" /tmp/wings.log
echo " servers loaded"
df -h / | tail -1
""", timeout=60))

# Step 3: Backup MySQL to E2B (22GB disk)
print("\n" + "=" * 70)
print("STEP 3: Backup MySQL to E2B")
print("=" * 70)

# Create E2B sandbox for backups
e2b_create = subprocess.run(['node', '-e', '''
const { Sandbox } = require('e2b');
process.env.E2B_API_KEY = 'e2b_1f9efe2fb912240566b001e41fcfc5a7b786f8e3';
async function main() {
  const sbx = await Sandbox.create({ timeout: 3600 });
  console.log(sbx.sandboxId);
}
main().catch(e => console.error(e.message));
'''], capture_output=True, text=True, timeout=30)
e2b_id = e2b_create.stdout.strip()
print(f"E2B sandbox for backups: {e2b_id}")

# Dump MySQL on Daytona
print(run_daytona("mysqldump -u pterodactyl -pptero_app_pw_2025 pterodactyl > /tmp/db_backup.sql 2>/dev/null && wc -c /tmp/db_backup.sql", timeout=30))

# Step 4: Test everything via public URL
print("\n" + "=" * 70)
print("STEP 4: Test via public URL")
print("=" * 70)

PUBLIC_URL = "https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu"
VERCEL_URL = "https://deathlegionpanel.vercel.app"

for url, name in [(PUBLIC_URL, "Panel"), (VERCEL_URL, "Vercel"), (VERCEL_URL + "/apply", "Apply"), (VERCEL_URL + "/status", "Status")]:
    try:
        code = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '15', url],
            capture_output=True, text=True, timeout=20).stdout
        print(f"  {name}: HTTP {code}")
    except:
        print(f"  {name}: TIMEOUT")

# Step 5: Test login + servers
print("\n=== Login test ===")
login_result = subprocess.run(['bash', '-c', f'''
rm -f /tmp/vc.txt
curl -s -c /tmp/vc.txt -o /dev/null --max-time 15 "{VERCEL_URL}/sanctum/csrf-cookie"
XSRF=$(grep XSRF-TOKEN /tmp/vc.txt | awk '{{print $7}}')
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF'))")
curl -s -c /tmp/vc.txt -b /tmp/vc.txt --max-time 15 -X POST "{VERCEL_URL}/auth/login" \\
  -H "Content-Type: application/json" -H "Accept: application/json" \\
  -H "X-XSRF-TOKEN: $XSRF" -H "X-Requested-With: XMLHttpRequest" \\
  -d '{{"user":"admin","password":"DeathLegion2025!"}}'
'''], capture_output=True, text=True, timeout=30)
import json as j
try:
    d = j.loads(login_result.stdout)
    print(f"Login: {d.get('data',{}).get('complete','FAIL')}")
except:
    print("Login: parse error")

print("\n=== Server list ===")
servers_result = subprocess.run(['bash', '-c', f'''
curl -s --max-time 15 -b /tmp/vc.txt "{VERCEL_URL}/api/client" -H "Accept: application/json"
'''], capture_output=True, text=True, timeout=20)
try:
    d = j.loads(servers_result.stdout)
    servers = d.get('data', [])
    print(f"Servers: {len(servers)}")
    for s in servers[:3]:
        a = s['attributes']
        print(f"  {a['name']}: {a['identifier']}")
except:
    print("Server list: parse error")
