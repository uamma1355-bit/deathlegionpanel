#!/usr/bin/env python3
"""Recover services: start MySQL, PHP-FPM, Wings properly."""
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

# 1. MariaDB
run("Start MariaDB", "sudo service mariadb start 2>&1 ; sleep 4 ; pgrep -x mysqld && echo 'MariaDB OK'")
# 2. PHP-FPM (try both versions)
run("Start PHP-FPM", "sudo service php8.2-fpm start 2>&1 ; sudo service php8.4-fpm start 2>&1 ; sleep 3 ; pgrep -f 'php-fpm' && echo 'PHP-FPM OK'")
# 3. Make sure redis and nginx are still up
run("Verify Redis+Nginx", "sudo service redis-server status 2>&1 | head -3 ; sudo service nginx status 2>&1 | head -3")

# 4. Wings — use sudo bash -c to handle redirect properly
run(
    "Start Wings (proper redirect)",
    "sudo bash -c 'nohup /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /var/log/wings-stdout.log 2>&1 &' ; sleep 6 ; pgrep -f '/usr/local/bin/wings' && echo 'Wings running' || echo 'Wings NOT running'",
)

# 5. Wait for Wings to fully boot
print("\nWaiting 10s for Wings to fully boot...")
time.sleep(10)

# 6. Verify all services
print("\n>>> Final service status")
run("All processes", "ps -eo pid,comm | grep -E 'wings|mysqld|redis|nginx|php-fpm' | sort -k2")

# 7. Test endpoints
print("\n>>> Endpoint tests")
run("Local Wings (8080)", "curl -sk -o /dev/null -w 'HTTP %{http_code}\\n' http://127.0.0.1:8080/api/system")
run("Via nginx (8000)", "curl -sk -o /dev/null -w 'HTTP %{http_code}\\n' -A 'Mozilla/5.0' http://127.0.0.1:8000/api/system")
run("Via Daytona URL", "curl -sk -o /dev/null -w 'HTTP %{http_code}\\n' -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/api/system")
run("Via Vercel", "curl -sk -o /dev/null -w 'HTTP %{http_code}\\n' -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' https://deathlegionpanel.vercel.app/api/system")

# 8. Wings log
print("\n>>> Wings log (last 40 lines)")
run("Wings log", "sudo tail -40 /var/log/pterodactyl/wings.log 2>&1")
