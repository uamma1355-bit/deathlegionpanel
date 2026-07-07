#!/usr/bin/env python3
"""
Daytona self-healing system for the FULL Pterodactyl Panel.

Runs on GitHub Actions every 5 minutes:
1. Checks if the panel is alive (ping /auth/login)
2. If ALIVE: runs MySQL backup → commits to GitHub repo
3. If DEAD: downloads Pterodactyl release, installs, restores, starts Wings
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

DAYTONA_TOKEN = os.environ.get("DAYTONA_TOKEN", "")
SANDBOX_NAME = os.environ.get("DAYTONA_SANDBOX_NAME", "pterodactyl-backend")
DAYTONA_API = "https://app.daytona.io/api"
SNAPSHOT = "daytonaio/sandbox:0.8.0"
REGION = "eu"

GH_TOKEN = os.environ.get("GH_TOKEN", "")
GH_REPO = os.environ.get("GH_REPO", "")
BACKUP_FILE = "backups/latest.sql.gz.b64"

VERCEL_TOKEN = os.environ.get("VERCEL_TOKEN", "")
VERCEL_PROJECT_ID = os.environ.get("VERCEL_PROJECT_ID", "")
VERCEL_ORG_ID = os.environ.get("VERCEL_ORG_ID", "")

MYSQL_ROOT_PW = os.environ.get("MYSQL_ROOT_PW", "ptero_root_pw_2025")
MYSQL_APP_PW = os.environ.get("MYSQL_APP_PW", "ptero_app_pw_2025")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@deathlegion.local")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "DeathLegion2025!")

REPO_ROOT = Path(__file__).resolve().parent.parent


def api_get(path):
    req = urllib.request.Request(f"{DAYTONA_API}{path}", headers={"Authorization": f"Bearer {DAYTONA_TOKEN}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_post(path, body, timeout=300):
    req = urllib.request.Request(
        f"{DAYTONA_API}{path}",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {DAYTONA_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout + 30) as resp:
        return json.loads(resp.read())


def exec_cmd(sandbox_id, command, timeout=300):
    try:
        result = api_post(
            f"/toolbox/{sandbox_id}/toolbox/process/execute",
            {"command": command, "cwd": "/home/daytona", "timeout": timeout},
            timeout=timeout + 10,
        )
        return int(result.get("exitCode", -1)), result.get("result", "")
    except Exception as e:
        return -1, str(e)


def find_sandbox(name):
    data = api_get("/sandbox")
    for sb in data.get("items", []):
        if sb["name"] == name:
            return sb
    return None


def get_preview_url(sandbox_id, port=8000):
    req = urllib.request.Request(
        f"{DAYTONA_API}/sandbox/{sandbox_id}/ports/{port}/preview-url",
        headers={"Authorization": f"Bearer {DAYTONA_TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
        return data.get("url", "")


def gh_api(method, path, body=None):
    url = f"https://api.github.com/repos/{GH_REPO}/{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Accept": "application/vnd.github+json", "Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def download_backup():
    if not GH_TOKEN or not GH_REPO:
        return None
    try:
        data = gh_api("GET", f"contents/{BACKUP_FILE}")
        download_url = data.get("download_url")
        if not download_url:
            return None
        req = urllib.request.Request(download_url)
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def upload_backup(b64_data):
    if not GH_TOKEN or not GH_REPO:
        return
    sha = None
    try:
        data = gh_api("GET", f"contents/{BACKUP_FILE}")
        sha = data.get("sha")
    except urllib.error.HTTPError:
        pass
    body = {"message": "chore: auto-backup MySQL data", "content": b64_data, "branch": "main"}
    if sha:
        body["sha"] = sha
    gh_api("PUT", f"contents/{BACKUP_FILE}", body)


def check_alive(public_url):
    try:
        req = urllib.request.Request(f"{public_url}/auth/login", headers={"Accept": "text/html"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 302, 403)
    except urllib.error.HTTPError as e:
        return e.code in (200, 302, 403)
    except Exception:
        return False


def do_backup(sandbox_id):
    print("=== Backing up MySQL ===")
    code, out = exec_cmd(
        sandbox_id,
        f"mysqldump -u root -p{MYSQL_ROOT_PW} --all-databases --single-transaction --routines --triggers 2>/dev/null | gzip | base64 -w0",
        timeout=120,
    )
    if code != 0 or not out.strip():
        print(f"  backup failed: {out[:200]}")
        return False
    upload_backup(out.strip())
    print(f"  Backup uploaded ({len(out)} bytes)")
    return True


def do_restore(sandbox_id, backup_b64):
    if not backup_b64:
        print("  No backup — starting fresh")
        return False
    print(f"=== Restoring MySQL ({len(backup_b64)} bytes) ===")
    b64_str = backup_b64.decode() if isinstance(backup_b64, bytes) else backup_b64
    CHUNK = 50000
    chunks = [b64_str[i:i + CHUNK] for i in range(0, len(b64_str), CHUNK)]
    exec_cmd(sandbox_id, "rm -f /tmp/restore.b64")
    for i, chunk in enumerate(chunks):
        exec_cmd(sandbox_id, f"printf '%s' '{chunk}' >> /tmp/restore.b64", timeout=15)
    code, out = exec_cmd(
        sandbox_id,
        f"base64 -d /tmp/restore.b64 > /tmp/restore.sql.gz && gunzip -f /tmp/restore.sql.gz && "
        f"mysql -u root -p{MYSQL_ROOT_PW} < /tmp/restore.sql 2>&1 | tail -3 && "
        f"rm -f /tmp/restore.b64 /tmp/restore.sql && echo RESTORED",
        timeout=120,
    )
    print(f"  Restore: {out[-100:]}")
    return "RESTORED" in out


def deploy_full_panel(sandbox_id, public_url, backup_b64):
    """Deploy the FULL official Pterodactyl Panel with pre-built assets."""
    print("  Step 1/9: Installing PHP + MySQL + Redis")
    exec_cmd(sandbox_id,
        "sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "
        "php-cli php-mbstring php-xml php-curl php-zip php-gd php-bcmath php-mysql php-redis php-gmp php-intl "
        "mariadb-server redis-server composer git unzip curl 2>&1 | tail -1 && echo OK",
        timeout=300)

    print("  Step 2/9: Starting MySQL + Redis")
    exec_cmd(sandbox_id,
        "sudo mkdir -p /run/mysqld && sudo chown mysql:mysql /run/mysqld && "
        "sudo mariadbd --user=mysql --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock "
        "--bind-address=127.0.0.1 --port=3306 > /tmp/mysql.log 2>&1 & sleep 5 && "
        "redis-server --daemonize yes --port 6379 --bind 127.0.0.1 && sleep 1 && echo OK",
        timeout=30)

    print("  Step 3/9: Configuring MySQL")
    exec_cmd(sandbox_id,
        f"mysql -u root -p{MYSQL_ROOT_PW} -e 'SELECT 1' 2>/dev/null || "
        f"sudo mysql -e \"ALTER USER root@localhost IDENTIFIED BY '{MYSQL_ROOT_PW}'; FLUSH PRIVILEGES;\" 2>/dev/null; "
        f"mysql -u root -p{MYSQL_ROOT_PW} -e \""
        f"CREATE USER IF NOT EXISTS pterodactyl@localhost IDENTIFIED BY '{MYSQL_APP_PW}';"
        f"CREATE DATABASE IF NOT EXISTS pterodactyl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        f"GRANT ALL PRIVILEGES ON pterodactyl.* TO pterodactyl@localhost;FLUSH PRIVILEGES;\" 2>&1 && echo OK",
        timeout=15)

    print("  Step 4/9: Downloading Pterodactyl release")
    exec_cmd(sandbox_id,
        "cd /home/daytona && curl -L -o panel.tar.gz https://github.com/pterodactyl/panel/releases/download/v1.11.3/panel.tar.gz 2>&1 | tail -1 && "
        "rm -rf pterodactyl-panel && mkdir pterodactyl-panel && cd pterodactyl-panel && tar xzf ../panel.tar.gz && echo OK",
        timeout=120)

    print("  Step 5/9: Composer install + .env")
    exec_cmd(sandbox_id,
        "cd /home/daytona/pterodactyl-panel && composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -1 && "
        "cp .env.example .env && "
        f"KEY=$(php -r 'echo base64_encode(random_bytes(32));') && "
        f"sed -i 's|^APP_KEY=.*|APP_KEY=base64:$KEY|' .env && "
        f"sed -i 's|^APP_ENV=.*|APP_ENV=local|' .env && "
        f"sed -i 's|^APP_URL=.*|APP_URL=http://localhost:8000|' .env && "
        f"sed -i 's|^DB_HOST=.*|DB_HOST=127.0.0.1|' .env && "
        f"sed -i 's|^DB_DATABASE=.*|DB_DATABASE=pterodactyl|' .env && "
        f"sed -i 's|^DB_USERNAME=.*|DB_USERNAME=pterodactyl|' .env && "
        f"sed -i 's|^DB_PASSWORD=.*|DB_PASSWORD={MYSQL_APP_PW}|' .env && "
        f"sed -i 's|^REDIS_HOST=.*|REDIS_HOST=127.0.0.1|' .env && "
        f"sed -i 's|^CACHE_DRIVER=.*|CACHE_DRIVER=redis|' .env && "
        f"sed -i 's|^SESSION_DRIVER=.*|SESSION_DRIVER=redis|' .env && "
        f"sed -i 's|^QUEUE_CONNECTION=.*|QUEUE_CONNECTION=redis|' .env && "
        f"sed -i 's|^MAIL_MAILER=.*|MAIL_MAILER=log|' .env && "
        f"sed -i 's|^RECAPTCHA_ENABLED=.*|RECAPTCHA_ENABLED=false|' .env && "
        f"echo ENV_OK",
        timeout=600)

    print("  Step 6/9: Migrating + restoring")
    if backup_b64:
        do_restore(sandbox_id, backup_b64)
    exec_cmd(sandbox_id,
        "cd /home/daytona/pterodactyl-panel && php artisan migrate --force --seed 2>&1 | tail -3 && echo OK",
        timeout=180)

    # Create server.php (critical for artisan serve)
    exec_cmd(sandbox_id,
        "cat > /home/daytona/pterodactyl-panel/server.php << 'PHPEOF'\n"
        "<?php\n"
        "$uri = urldecode(parse_url($_SERVER[\"REQUEST_URI\"], PHP_URL_PATH));\n"
        "if ($uri !== \"/\" && file_exists(__DIR__ . \"/public\" . $uri)) {\n"
        "    return false;\n"
        "}\n"
        "require_once __DIR__ . \"/public/index.php\";\n"
        "PHPEOF",
        timeout=10)

    print("  Step 7/9: Setting up node + Wings config")
    SCRIPT = r'''
<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Allocation;
use Illuminate\Support\Str;
$loc = Location::firstOrCreate(["short" => "local"], ["long" => "Local"]);
$node = Node::firstOrCreate(
    ["fqdn" => "localhost"],
    ["uuid" => Str::uuid(), "public" => true, "name" => "Local Node",
     "location_id" => $loc->id, "scheme" => "http", "behind_proxy" => false,
     "memory" => 2048, "memory_overallocate" => 0, "disk" => 10240,
     "disk_overallocate" => 0, "upload_size" => 100,
     "daemonBase" => "/var/lib/pterodactyl/volumes", "daemonSFTP" => 2022,
     "daemonListen" => 8080, "daemon_token" => encrypt(Str::random(64)),
     "daemon_token_id" => Str::random(16), "maintenance_mode" => false]
);
for ($p = 25565; $p <= 25580; $p++) {
    Allocation::firstOrCreate(["node_id" => $node->id, "ip" => "0.0.0.0", "port" => $p]);
}
$token = decrypt($node->getAttributes()["daemon_token"]);
$tokenId = $node->daemon_token_id;
$config = "debug: false\napi:\n  host: 127.0.0.1\n  port: 8080\n  ssl:\n    enabled: false\nsystem:\n  data: /var/lib/pterodactyl/volumes\n  sftp:\n    bind_port: 2022\n  user:\n    root: true\nremote: http://127.0.0.1:8000\ntoken_id: \"$tokenId\"\ntoken: \"$token\"\n";
file_put_contents("/etc/pterodactyl/config.yml", $config);
echo "NODE_OK\n";
'''
    b64 = base64.b64encode(SCRIPT.encode()).decode()
    exec_cmd(sandbox_id,
        f"printf '%s' '{b64}' | base64 -d > /tmp/setup.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/setup.php 2>&1; rm /tmp/setup.php",
        timeout=30)

    print("  Step 8/9: Starting panel + Wings")
    exec_cmd(sandbox_id,
        "cd /home/daytona/pterodactyl-panel && "
        "php artisan config:cache 2>&1 | tail -1 && "
        "php artisan route:cache 2>&1 | tail -1 && "
        "php artisan view:cache 2>&1 | tail -1 && "
        "mkdir -p storage/framework/views storage/framework/sessions storage/framework/cache && "
        "chmod -R 775 storage bootstrap/cache && "
        "sudo pkill -9 -f 'artisan serve' 2>/dev/null; sleep 2 && "
        "setsid nohup php artisan serve --host=0.0.0.0 --port=8000 > storage/logs/server.log 2>&1 < /dev/null & disown && "
        "sleep 4 && "
        # Install Docker + Wings if not present
        "which docker >/dev/null 2>&1 || (curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh) ; "
        "sudo dockerd > /tmp/dockerd.log 2>&1 & sleep 3; "
        "which wings >/dev/null 2>&1 || (sudo curl -fsSL -o /usr/local/bin/wings https://github.com/pterodactyl/wings/releases/download/v1.13.1/wings_linux_amd64 && sudo chmod +x /usr/local/bin/wings) ; "
        "sudo mkdir -p /etc/pterodactyl /var/lib/pterodactyl/volumes ; "
        "sudo pkill -9 -f wings 2>/dev/null; sleep 1 && "
        "sudo setsid nohup /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 < /dev/null & disown && "
        "sleep 4 && echo OK",
        timeout=300)

    print("  Step 9/9: Creating admin if missing")
    exec_cmd(sandbox_id,
        f"cd /home/daytona/pterodactyl-panel && php artisan p:user:make "
        f"--email {ADMIN_EMAIL} --username {ADMIN_USERNAME} "
        f"--name-first Admin --name-last User "
        f"--password '{ADMIN_PASSWORD}' --admin 1 2>&1 | tail -3; echo DONE",
        timeout=30)

    return True


def main():
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Self-heal check starting")

    sb = find_sandbox(SANDBOX_NAME)
    if not sb:
        print("  Sandbox not found — creating new one")
        try:
            sb = api_post("/sandbox", {
                "name": SANDBOX_NAME, "snapshot": SNAPSHOT, "target": REGION,
                "public": True, "autoStopInterval": 0, "autoArchiveInterval": 0, "autoDeleteInterval": -1,
            }, timeout=60)
            time.sleep(10)
        except Exception as e:
            print(f"  Create failed: {e}")
            return 1
    elif sb["state"] in ("archived", "stopped", "paused"):
        print(f"  Sandbox state={sb['state']} — starting")
        try:
            api_post(f"/sandbox/{sb['id']}/start", {})
            time.sleep(30)
        except Exception:
            try:
                api_post(f"/sandbox/{sb['id']}", {}, method="DELETE")
            except Exception:
                pass

    sandbox_id = sb["id"]
    public_url = get_preview_url(sandbox_id, 8000)
    print(f"  Public URL: {public_url}")

    alive = check_alive(public_url)
    print(f"  Backend alive: {alive}")

    if alive:
        print("  Backend alive — running MySQL backup")
        do_backup(sandbox_id)
        print("  ✓ Done")
        return 0

    print("  Backend dead — downloading backup + redeploying")
    backup_b64 = download_backup()
    print(f"  Backup: {'available' if backup_b64 else 'none (fresh deploy)'}")

    success = deploy_full_panel(sandbox_id, public_url, backup_b64)
    if not success:
        print("  Deploy failed — will retry next cycle")
        return 1

    time.sleep(5)
    alive = check_alive(public_url)
    if not alive:
        print("  Still not responding — will retry")
        return 1

    print(f"  ✓ Panel is live at {public_url}")
    do_backup(sandbox_id)
    print("  ✓ Self-heal complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
